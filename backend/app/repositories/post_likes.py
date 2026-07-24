from __future__ import annotations

from uuid import UUID

from sqlalchemy import delete, func, select, tuple_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenError, NotFoundError
from app.models import Character, CharacterPostLike, User
from app.schemas.post_likes import PostLikeItem, PostLikesQuery, PostLikesResponse, PostLikeTarget, PostLikeUpdate


PostKey = tuple[UUID, str]


class PostLikesRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def query(self, user: User, payload: PostLikesQuery) -> PostLikesResponse:
        await self._require_owned_character(user.id, payload.liker_account_id)
        targets = self._unique_targets(payload.targets)
        character_rows = await self._character_rows({item.target_character_id for item in targets})
        base_likes = self._available_posts(targets, character_rows)
        counts = await self._like_counts(set(base_likes))
        liked = await self._liked_keys(user.id, payload.liker_account_id, set(base_likes))
        items = [self._query_item(item, base_likes, counts, liked) for item in targets]
        return PostLikesResponse(items=items)

    async def update(self, user: User, payload: PostLikeUpdate) -> PostLikeItem:
        await self._require_owned_character(user.id, payload.liker_account_id)
        target = await self._require_character(payload.target_character_id)
        base_likes = self._post_base_likes(target, payload.post_id)
        if base_likes is None:
            raise NotFoundError("Post not found")
        await self._set_like(user.id, payload)
        likes = base_likes + await self._like_count((target.id, payload.post_id))
        await self.session.commit()
        return PostLikeItem(**payload.model_dump(exclude={"liker_account_id"}), available=True, likes=likes)

    async def _require_owned_character(self, owner_id: UUID, account_id: str) -> None:
        stmt = select(Character.id).where(Character.owner_id == owner_id, Character.source_account_id == account_id)
        result = await self.session.execute(stmt)
        if result.scalar_one_or_none() is None:
            raise ForbiddenError("Character is not owned by the current user")

    async def _require_character(self, character_id: UUID) -> Character:
        result = await self.session.execute(select(Character).where(Character.id == character_id))
        row = result.scalar_one_or_none()
        if not row:
            raise NotFoundError("Character not found")
        return row

    async def _set_like(self, owner_id: UUID, payload: PostLikeUpdate) -> None:
        values = {"liker_owner_id": owner_id, "liker_account_id": payload.liker_account_id, "target_character_id": payload.target_character_id, "target_post_id": payload.post_id}
        if payload.liked:
            stmt = insert(CharacterPostLike).values(values).on_conflict_do_nothing(constraint="uq_character_post_likes")
            await self.session.execute(stmt)
            return
        stmt = delete(CharacterPostLike).where(CharacterPostLike.liker_owner_id == owner_id, CharacterPostLike.liker_account_id == payload.liker_account_id, CharacterPostLike.target_character_id == payload.target_character_id, CharacterPostLike.target_post_id == payload.post_id)
        await self.session.execute(stmt)

    async def _character_rows(self, ids: set[UUID]) -> dict[UUID, Character]:
        if not ids:
            return {}
        result = await self.session.execute(select(Character).where(Character.id.in_(ids)))
        return {row.id: row for row in result.scalars().all()}

    async def _like_counts(self, keys: set[PostKey]) -> dict[PostKey, int]:
        if not keys:
            return {}
        pair = tuple_(CharacterPostLike.target_character_id, CharacterPostLike.target_post_id)
        stmt = select(CharacterPostLike.target_character_id, CharacterPostLike.target_post_id, func.count()).where(pair.in_(keys)).group_by(CharacterPostLike.target_character_id, CharacterPostLike.target_post_id)
        result = await self.session.execute(stmt)
        return {(row[0], row[1]): int(row[2]) for row in result.all()}

    async def _like_count(self, key: PostKey) -> int:
        stmt = select(func.count()).select_from(CharacterPostLike).where(CharacterPostLike.target_character_id == key[0], CharacterPostLike.target_post_id == key[1])
        result = await self.session.execute(stmt)
        return int(result.scalar_one())

    async def _liked_keys(self, owner_id: UUID, account_id: str, keys: set[PostKey]) -> set[PostKey]:
        if not keys:
            return set()
        pair = tuple_(CharacterPostLike.target_character_id, CharacterPostLike.target_post_id)
        stmt = select(CharacterPostLike.target_character_id, CharacterPostLike.target_post_id).where(CharacterPostLike.liker_owner_id == owner_id, CharacterPostLike.liker_account_id == account_id, pair.in_(keys))
        result = await self.session.execute(stmt)
        return {(row[0], row[1]) for row in result.all()}

    def _available_posts(self, targets: list[PostLikeTarget], character_rows: dict[UUID, Character]) -> dict[PostKey, int]:
        available: dict[PostKey, int] = {}
        for target in targets:
            character = character_rows.get(target.target_character_id)
            base_likes = self._post_base_likes(character, target.post_id) if character else None
            if base_likes is not None:
                available[(target.target_character_id, target.post_id)] = base_likes
        return available

    def _post_base_likes(self, character: Character, post_id: str) -> int | None:
        posts = character.posts
        if not isinstance(posts, list):
            return None
        post = next((item for item in posts if isinstance(item, dict) and str(item.get("id")) == post_id), None)
        if not post:
            return None
        value = post.get("likes", 0)
        return max(0, int(value)) if isinstance(value, (int, float)) and not isinstance(value, bool) else 0

    def _query_item(self, target: PostLikeTarget, base: dict[PostKey, int], counts: dict[PostKey, int], liked: set[PostKey]) -> PostLikeItem:
        key = (target.target_character_id, target.post_id)
        available = key in base
        likes = base.get(key, 0) + counts.get(key, 0) if available else 0
        return PostLikeItem(**target.model_dump(), available=available, liked=key in liked, likes=likes)

    def _unique_targets(self, targets: list[PostLikeTarget]) -> list[PostLikeTarget]:
        unique: dict[PostKey, PostLikeTarget] = {}
        for target in targets:
            unique.setdefault((target.target_character_id, target.post_id), target)
        return list(unique.values())
