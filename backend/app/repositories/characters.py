from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import CharacterHandleTakenError
from app.models import Character, CharacterFollow, SharedCharacter, User
from app.schemas.characters import CharacterHandleAvailabilityResponse, CharacterWrite, CharacterWriteResponse
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

    def _values(self, owner_id: UUID, source_account_id: str, payload: CharacterWrite) -> dict[str, object]:
        character = {**payload.character, "name": payload.name, "handle": payload.handle}
        return {"owner_id": owner_id, "source_account_id": source_account_id, "name": payload.name, "handle": payload.handle, "character": character, "gallery": payload.gallery, "following": payload.following}

    def _upsert_statement(self, values: dict[str, object]) -> object:
        statement = insert(Character).values(values)
        mutable = ["name", "handle", "character", "gallery", "following"]
        updates = {column: statement.excluded[column] for column in mutable}
        return statement.on_conflict_do_update(constraint="uq_characters_owner_source", set_=updates).returning(Character)

    async def _sync_snapshots(self, row: Character) -> None:
        shared = await self._shared(row.owner_id, row.source_account_id)
        followers = await self._followers(row.owner_id, row.source_account_id)
        if shared:
            shared.handle = row.handle
            shared.character = {**dict(shared.character or {}), "handle": row.handle}
        for follower in followers:
            follower.follower_character = {**dict(follower.follower_character or {}), "handle": row.handle}

    async def _shared(self, owner_id: UUID, source_account_id: str) -> SharedCharacter | None:
        statement = select(SharedCharacter).where(SharedCharacter.owner_id == owner_id, SharedCharacter.source_account_id == source_account_id)
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def _followers(self, owner_id: UUID, source_account_id: str) -> list[CharacterFollow]:
        statement = select(CharacterFollow).where(CharacterFollow.follower_id == owner_id, CharacterFollow.follower_account_id == source_account_id)
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    def _raise_integrity_error(self, error: IntegrityError) -> None:
        if self._constraint_name(error) == "uq_characters_handle":
            raise CharacterHandleTakenError() from error
        raise error

    def _constraint_name(self, error: IntegrityError) -> str:
        diagnostic = getattr(error.orig, "diag", None)
        return str(getattr(diagnostic, "constraint_name", ""))

    def _response(self, row: Character) -> CharacterWriteResponse:
        return CharacterWriteResponse(source_account_id=row.source_account_id, name=row.name, handle=row.handle, character=row.character, gallery=list(row.gallery or []), following=list(row.following or []))
