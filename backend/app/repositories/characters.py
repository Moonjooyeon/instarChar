from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequestError, CharacterHandleTakenError
from app.core.recommendations import character_recommendation_terms
from app.models import Character, CharacterFollow, SharedCharacter, User
from app.repositories.media_assets import MediaAssetRepository
from app.schemas.characters import CharacterHandleAvailabilityResponse, CharacterVisibilityResponse, CharacterWrite, CharacterWriteResponse
from app.services.content_safety import require_safe_content


class CharacterRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def availability(self, user: User, handle: str, exclude_source_account_id: str = "") -> CharacterHandleAvailabilityResponse:
        statement = select(Character).where(Character.handle == handle)
        result = await self.session.execute(statement)
        row = result.scalar_one_or_none()
        excluded = bool(row and row.owner_id == user.id and row.source_account_id == exclude_source_account_id)
        return CharacterHandleAvailabilityResponse(handle=handle, available=row is None or excluded)

    async def save(self, user: User, source_account_id: str, payload: CharacterWrite) -> CharacterWriteResponse:
        require_safe_content(payload.model_dump(mode="python"))
        await MediaAssetRepository(self.session).require_owned_ready_references(user, [payload.character, payload.gallery], _PUBLIC_MEDIA_PURPOSES, source_account_id)
        values = self._values(user.id, source_account_id, payload)
        statement = self._upsert_statement(values)
        try:
            result = await self.session.execute(statement)
            row = result.scalar_one()
            await self._sync_snapshots(row)
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            self._raise_integrity_error(error)
        return self._response(row)

    async def update_visibility(self, user: User, source_account_id: str, is_public: bool) -> CharacterVisibilityResponse:
        row = await self._owned(user.id, source_account_id)
        row.is_public = is_public
        shared = await self._sync_public_snapshot(row) if is_public else await self._shared(row.owner_id, row.source_account_id)
        await self.session.commit()
        return CharacterVisibilityResponse(is_public=row.is_public, shared_id=str(shared.id) if is_public and shared else "")

    def _values(self, owner_id: UUID, source_account_id: str, payload: CharacterWrite) -> dict[str, object]:
        character = {**payload.character, "name": payload.name, "handle": payload.handle}
        if payload.is_public is not None:
            character["isPublic"] = payload.is_public
        values = {"owner_id": owner_id, "source_account_id": source_account_id, "name": payload.name, "handle": payload.handle, "character": character, "gallery": payload.gallery, "following": payload.following}
        if payload.is_public is not None:
            values["is_public"] = payload.is_public
        return values

    def _upsert_statement(self, values: dict[str, object]) -> object:
        statement = insert(Character).values(values)
        mutable = ["name", "handle", "character", "gallery", "following"]
        if "is_public" in values:
            mutable.append("is_public")
        updates = {column: statement.excluded[column] for column in mutable}
        return statement.on_conflict_do_update(constraint="uq_characters_owner_source", set_=updates).returning(Character)

    async def _sync_snapshots(self, row: Character) -> None:
        shared = await self._shared(row.owner_id, row.source_account_id)
        followers = await self._followers(row.owner_id, row.source_account_id)
        if shared:
            self._apply_public_snapshot(shared, row)
        for follower in followers:
            follower.follower_character = {**dict(follower.follower_character or {}), "handle": row.handle}

    async def _owned(self, owner_id: UUID, source_account_id: str) -> Character:
        statement = select(Character).where(Character.owner_id == owner_id, Character.source_account_id == source_account_id)
        result = await self.session.execute(statement.with_for_update())
        row = result.scalar_one_or_none()
        if not row:
            raise BadRequestError("Character not found")
        return row

    async def _sync_public_snapshot(self, row: Character) -> SharedCharacter:
        shared = await self._shared(row.owner_id, row.source_account_id)
        if not shared:
            shared = SharedCharacter(owner_id=row.owner_id, source_account_id=row.source_account_id, name=row.name, handle=row.handle)
            self.session.add(shared)
        self._apply_public_snapshot(shared, row)
        return shared

    def _apply_public_snapshot(self, shared: SharedCharacter, row: Character) -> None:
        shared.name = row.name
        shared.handle = row.handle
        shared.owner_name = str(row.character.get("ownerName") or "user")
        shared.persona = str(row.character.get("persona") or "")
        shared.tags = character_recommendation_terms(row.character)
        shared.character = self._public_character(row)

    async def _shared(self, owner_id: UUID, source_account_id: str) -> SharedCharacter | None:
        statement = select(SharedCharacter).where(SharedCharacter.owner_id == owner_id, SharedCharacter.source_account_id == source_account_id)
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def _followers(self, owner_id: UUID, source_account_id: str) -> list[CharacterFollow]:
        statement = select(CharacterFollow).where(CharacterFollow.follower_id == owner_id, CharacterFollow.follower_account_id == source_account_id)
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    def _public_character(self, row: Character) -> dict[str, object]:
        return {**dict(row.character or {}), "following": list(row.following or []), "gallery": list(row.gallery or []), "handle": row.handle, "posts": list(row.posts or [])}

    def _raise_integrity_error(self, error: IntegrityError) -> None:
        if self._constraint_name(error) == "uq_characters_handle":
            raise CharacterHandleTakenError() from error
        raise error

    def _constraint_name(self, error: IntegrityError) -> str:
        diagnostic = getattr(error.orig, "diag", None)
        return str(getattr(diagnostic, "constraint_name", ""))

    def _response(self, row: Character) -> CharacterWriteResponse:
        return CharacterWriteResponse(source_account_id=row.source_account_id, name=row.name, handle=row.handle, character=row.character, gallery=list(row.gallery or []), following=list(row.following or []), is_public=row.is_public is not False)


_PUBLIC_MEDIA_PURPOSES = {"profile_avatar", "profile_header", "gallery", "feed_post"}
