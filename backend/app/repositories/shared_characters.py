from typing import Optional
from uuid import UUID

from sqlalchemy import delete, func, select, tuple_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Character, CharacterFollow, SharedCharacter, User
from app.schemas.shared_characters import DiscoverCharacter, FollowRequest, FollowSnapshotRequest, FollowerRow, SharedCharacterUpdate


class ShareId:
    def __init__(self, value: Optional[UUID]) -> None:
        self.value = value


class SharedCharacterRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def discover(self) -> list[DiscoverCharacter]:
        character_rows = await self._characters()
        shared_rows = await self._shared_characters()
        merged = {self._source_key(row): self._character_dto(row) for row in character_rows}
        for row in shared_rows:
            merged[self._source_key(row)] = self._shared_dto(row)
        return list(merged.values())

    async def get_shared(self, shared_id: UUID) -> Optional[DiscoverCharacter]:
        row = await self._shared_by_id(shared_id)
        return self._shared_dto(row) if row else None

    async def get_share_id(self, user: User, source_account_id: str) -> ShareId:
        row = await self._shared_by_source(user.id, source_account_id)
        return ShareId(row.id if row else None)

    async def upsert_shared(self, user: User, source_account_id: str, payload: SharedCharacterUpdate) -> ShareId:
        row = self._payload_row(user, source_account_id, payload)
        stmt = insert(SharedCharacter).values(row)
        update_columns = {key: stmt.excluded[key] for key in row if key not in ["owner_id", "source_account_id"]}
        result = await self.session.execute(stmt.on_conflict_do_update(index_elements=["owner_id", "source_account_id"], set_=update_columns).returning(SharedCharacter.id))
        await self.session.commit()
        return ShareId(result.scalar_one())

    async def patch_shared(self, user: User, source_account_id: str, payload: SharedCharacterUpdate) -> None:
        await self.upsert_shared(user, source_account_id, payload)

    async def delete_shared(self, user: User, source_account_id: str) -> None:
        stmt = delete(SharedCharacter).where(SharedCharacter.owner_id == user.id, SharedCharacter.source_account_id == source_account_id)
        await self.session.execute(stmt)
        await self.session.commit()

    async def follower_counts(self, ids: list[UUID]) -> dict[UUID, int]:
        if not ids:
            return {}
        stmt = select(CharacterFollow.target_shared_character_id, func.count()).where(CharacterFollow.target_shared_character_id.in_(ids)).group_by(CharacterFollow.target_shared_character_id)
        result = await self.session.execute(stmt)
        counts = {shared_id: 0 for shared_id in ids}
        counts.update({row[0]: row[1] for row in result.all()})
        return counts

    async def followers(self, shared_id: UUID) -> list[FollowerRow]:
        rows = await self._follow_rows(shared_id)
        shared_rows = await self._shared_by_follow_rows(rows)
        return [self._follower_dto(row, shared_rows.get((row.follower_id, row.follower_account_id))) for row in rows]

    async def follow(self, user: User, shared_id: UUID, payload: FollowRequest) -> bool:
        if not await self._shared_by_id(shared_id):
            return False
        await self._upsert_follow(user.id, shared_id, payload)
        await self.session.commit()
        return True

    async def unfollow(self, user: User, shared_id: UUID, follower_account_id: str) -> None:
        stmt = delete(CharacterFollow).where(CharacterFollow.follower_id == user.id, CharacterFollow.follower_account_id == follower_account_id, CharacterFollow.target_shared_character_id == shared_id)
        await self.session.execute(stmt)
        await self.session.commit()

    async def sync_owned_follow_snapshots(self, user: User, payload: FollowSnapshotRequest) -> None:
        rows = [self._follow_row(user.id, item.target_shared_character_id, item) for item in payload.rows]
        await self._upsert(CharacterFollow, rows, ["follower_id", "follower_account_id", "target_shared_character_id"])
        await self.session.commit()

    async def relationship_follow_back(self, user: User, follower_id: UUID, target_id: UUID) -> bool:
        follower = await self._shared_by_id(follower_id)
        target = await self._shared_by_id(target_id)
        if not self._can_follow_back(user, follower, target):
            return False
        if not await self._has_follow(user.id, target.source_account_id, follower.id):
            return False
        await self._upsert_follow(follower.owner_id, target.id, self._follow_back_payload(follower))
        await self.session.commit()
        return True

    async def _characters(self) -> list[Character]:
        result = await self.session.execute(select(Character).limit(120))
        return list(result.scalars().all())

    async def _shared_characters(self) -> list[SharedCharacter]:
        result = await self.session.execute(select(SharedCharacter).order_by(SharedCharacter.created_at.desc()).limit(80))
        return list(result.scalars().all())

    async def _shared_by_id(self, shared_id: UUID) -> Optional[SharedCharacter]:
        result = await self.session.execute(select(SharedCharacter).where(SharedCharacter.id == shared_id))
        return result.scalar_one_or_none()

    async def _shared_by_source(self, owner_id: UUID, source_account_id: str) -> Optional[SharedCharacter]:
        result = await self.session.execute(select(SharedCharacter).where(SharedCharacter.owner_id == owner_id, SharedCharacter.source_account_id == source_account_id))
        return result.scalar_one_or_none()

    async def _follow_rows(self, shared_id: UUID) -> list[CharacterFollow]:
        stmt = select(CharacterFollow).where(CharacterFollow.target_shared_character_id == shared_id).order_by(CharacterFollow.created_at.desc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def _shared_by_follow_rows(self, rows: list[CharacterFollow]) -> dict[tuple[UUID, str], SharedCharacter]:
        if not rows:
            return {}
        filters = [(row.follower_id, row.follower_account_id) for row in rows]
        result = await self.session.execute(select(SharedCharacter).where(tuple_(SharedCharacter.owner_id, SharedCharacter.source_account_id).in_(filters)))
        return {(row.owner_id, row.source_account_id): row for row in result.scalars().all()}

    async def _has_follow(self, follower_id: UUID, account_id: str, target_id: UUID) -> bool:
        stmt = select(CharacterFollow.id).where(CharacterFollow.follower_id == follower_id, CharacterFollow.follower_account_id == account_id, CharacterFollow.target_shared_character_id == target_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None

    def _payload_row(self, user: User, source_account_id: str, payload: SharedCharacterUpdate) -> dict[str, object]:
        row = payload.model_dump(mode="python")
        row["owner_id"] = user.id
        row["source_account_id"] = source_account_id
        return row

    def _follow_row(self, follower_id: UUID, target_id: UUID, payload: FollowRequest) -> dict[str, object]:
        return payload.model_dump(mode="python") | {"follower_id": follower_id, "target_shared_character_id": target_id}

    async def _upsert_follow(self, follower_id: UUID, target_id: UUID, payload: FollowRequest) -> None:
        row = self._follow_row(follower_id, target_id, payload)
        await self._upsert(CharacterFollow, [row], ["follower_id", "follower_account_id", "target_shared_character_id"])

    def _follow_back_payload(self, follower: SharedCharacter) -> FollowRequest:
        return FollowRequest(follower_name=follower.owner_name, follower_account_id=follower.source_account_id, follower_character=follower.character)

    def _shared_dto(self, row: SharedCharacter) -> DiscoverCharacter:
        return DiscoverCharacter(id=f"shared_{row.id}", sharedId=str(row.id), ownerId=row.owner_id, sourceAccountId=row.source_account_id, owner=f"@{row.owner_name or 'user'}", ownerName=row.owner_name or "user", shared=True, name=row.name, handle=row.handle, persona=row.persona, tags=row.tags, posts=list(row.character.get("posts", [])), character=row.character)

    def _character_dto(self, row: Character) -> DiscoverCharacter:
        tags = [row.character.get("age"), row.character.get("surface"), row.character.get("interests")]
        return DiscoverCharacter(id=f"char_{row.owner_id}_{row.source_account_id}", ownerId=row.owner_id, sourceAccountId=row.source_account_id, owner=f"@{row.character.get('ownerName', 'user')}", ownerName=str(row.character.get("ownerName", "user")), autoSynced=True, name=row.name, handle=row.handle, persona=str(row.character.get("persona", "")), tags=[item for item in tags if item], posts=row.posts, gallery=row.gallery, following=row.following, character=row.character)

    def _source_key(self, row: object) -> str:
        return f"{row.owner_id}:{row.source_account_id}"

    def _follower_dto(self, row: CharacterFollow, shared: Optional[SharedCharacter]) -> FollowerRow:
        character = row.follower_character or {}
        return FollowerRow(id=f"follower_{row.id}", shared=bool(shared), sharedId=str(shared.id) if shared else "", ownerId=row.follower_id, sourceAccountId=row.follower_account_id, name=str(character.get("name") or row.follower_name or "이름 없음"), handle=str(character.get("handle") or ""), owner=f"@{row.follower_name or 'user'}", ownerName=row.follower_name or "user", followerAccountId=row.follower_account_id, followedAt=row.created_at, character=character)

    def _can_follow_back(self, user: User, follower: Optional[SharedCharacter], target: Optional[SharedCharacter]) -> bool:
        if not follower or not target or target.owner_id != user.id:
            return False
        return self._mutual_love(follower, target)

    def _mutual_love(self, follower: SharedCharacter, target: SharedCharacter) -> bool:
        follower_rel = str(follower.character.get("relations") or follower.persona or "")
        target_rel = str(target.character.get("relations") or target.persona or "")
        return self._relation_mentions(follower_rel, target.name) and self._relation_mentions(target_rel, follower.name)

    def _relation_mentions(self, relation: str, name: str) -> bool:
        compact_relation = relation.lower().replace(" ", "")
        compact_name = name.lower().replace(" ", "")
        tail_name = name.lower().split()[-1] if name.split() else compact_name
        love_words = ["연인", "애인", "연애", "사랑", "부부", "배우자", "약혼", "반려"]
        return (compact_name in compact_relation or tail_name in relation.lower()) and any(word in relation for word in love_words)
