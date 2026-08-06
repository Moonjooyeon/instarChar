from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequestError, ConflictError
from app.models import Character, SharedCharacter, User
from app.schemas.character_posts import AutoPostUpdate, CharacterPostCommentCreate, CharacterPostCommentsResponse, CharacterPostsResponse, CharacterPostsUpdate
from app.services.content_safety import require_safe_content


class CharacterPostsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, user: User, source_account_id: str) -> CharacterPostsResponse:
        row = await self.owned_character(user.id, source_account_id)
        return self.response(row)

    async def save(self, user: User, source_account_id: str, payload: CharacterPostsUpdate) -> CharacterPostsResponse:
        require_safe_content(payload.posts)
        row = await self.owned_character(user.id, source_account_id, lock=True)
        if row.posts_revision != payload.revision:
            raise ConflictError("Post revision is stale")
        row.posts = list(payload.posts)
        row.posts_revision += 1
        await self._sync_shared_posts(row)
        await self.session.commit()
        return self.response(row)

    async def update_auto_post(self, user: User, source_account_id: str, payload: AutoPostUpdate) -> CharacterPostsResponse:
        row = await self.owned_character(user.id, source_account_id, lock=True)
        row.auto_post_enabled = payload.enabled
        row.auto_post_interval_seconds = payload.interval_seconds
        row.next_auto_post_at = self._next_run(payload) if payload.enabled else None
        row.last_auto_post_error = ""
        row.auto_post_failure_count = 0
        await self.session.commit()
        return self.response(row)

    async def append_generated_post(self, owner_id: UUID, source_account_id: str, post: dict[str, object], is_auto: bool = False) -> CharacterPostsResponse:
        require_safe_content(post)
        row = await self.owned_character(owner_id, source_account_id, lock=True)
        row.posts = [post, *list(row.posts or [])][:40]
        row.posts_revision += 1
        if is_auto:
            row.last_auto_post_at = datetime.now(timezone.utc)
            row.last_auto_post_error = ""
            row.auto_post_failure_count = 0
        await self._sync_shared_posts(row)
        await self.session.commit()
        return self.response(row)

    async def append_public_comment(self, user: User, character_id: UUID, post_id: str, payload: CharacterPostCommentCreate) -> CharacterPostCommentsResponse:
        require_safe_content(payload.text)
        await self.owned_character(user.id, payload.commenter_account_id)
        row = await self.public_character(character_id)
        comments = self._append_comment(row, post_id, payload)
        await self._sync_shared_posts(row)
        await self.session.commit()
        return CharacterPostCommentsResponse(comments=comments)

    async def record_auto_failure(self, owner_id: UUID, source_account_id: str, error: str, retry_at: datetime) -> None:
        row = await self.owned_character(owner_id, source_account_id, lock=True)
        row.last_auto_post_error = error[:500]
        row.auto_post_failure_count += 1
        row.next_auto_post_at = retry_at
        await self.session.commit()

    async def owned_character(self, owner_id: UUID, source_account_id: str, lock: bool = False) -> Character:
        stmt = select(Character).where(Character.owner_id == owner_id, Character.source_account_id == source_account_id)
        result = await self.session.execute(stmt.with_for_update() if lock else stmt)
        row = result.scalar_one_or_none()
        if not row:
            raise BadRequestError("Character not found")
        return row

    async def public_character(self, character_id: UUID) -> Character:
        stmt = select(Character).where(Character.id == character_id)
        result = await self.session.execute(stmt.with_for_update())
        row = result.scalar_one_or_none()
        if not row or not await self._is_shared(row):
            raise BadRequestError("Public character not found")
        return row

    def response(self, row: Character) -> CharacterPostsResponse:
        return CharacterPostsResponse(
            posts=list(row.posts or []),
            revision=row.posts_revision,
            auto_post_enabled=row.auto_post_enabled,
            auto_post_interval_seconds=row.auto_post_interval_seconds,
            next_auto_post_at=row.next_auto_post_at,
            last_auto_post_at=row.last_auto_post_at,
            last_auto_post_error=row.last_auto_post_error,
            auto_post_failure_count=row.auto_post_failure_count,
        )

    async def _sync_shared_posts(self, row: Character) -> None:
        stmt = select(SharedCharacter).where(SharedCharacter.owner_id == row.owner_id, SharedCharacter.source_account_id == row.source_account_id)
        result = await self.session.execute(stmt)
        shared = result.scalar_one_or_none()
        if not shared:
            return
        shared.character = {**dict(shared.character or {}), "posts": list(row.posts or [])}

    async def _is_shared(self, row: Character) -> bool:
        stmt = select(SharedCharacter.id).where(SharedCharacter.owner_id == row.owner_id, SharedCharacter.source_account_id == row.source_account_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None

    def _append_comment(self, row: Character, post_id: str, payload: CharacterPostCommentCreate) -> list[object]:
        posts = [dict(post) for post in row.posts if isinstance(post, dict)]
        post = next((item for item in posts if str(item.get("id")) == post_id), None)
        if not post:
            raise BadRequestError("Post not found")
        comments = [comment for comment in post.get("comments", []) if isinstance(comment, dict)]
        comments.append(self._comment_value(payload))
        post["comments"] = comments[-60:]
        row.posts = posts
        row.posts_revision += 1
        return post["comments"]

    def _comment_value(self, payload: CharacterPostCommentCreate) -> dict[str, object]:
        return {"byUser": True, "handle": payload.handle, "name": payload.name, "replyTo": payload.reply_to, "text": payload.text}

    def _next_run(self, payload: AutoPostUpdate) -> datetime:
        return datetime.now(timezone.utc) + timedelta(seconds=payload.interval_seconds)
