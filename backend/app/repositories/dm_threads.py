from typing import Optional
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenError
from app.models import DmThread, SharedDmThread, User
from app.schemas.dm_threads import DmThreadPayload, SharedDmThreadPayload


class DmThreadRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_owner_thread(self, user: User, thread_key: str) -> Optional[DmThread]:
        result = await self.session.execute(select(DmThread).where(DmThread.owner_id == user.id, DmThread.thread_key == thread_key))
        return result.scalar_one_or_none()

    async def upsert_owner_thread(self, user: User, payload: DmThreadPayload) -> None:
        row = payload.model_dump(mode="python") | {"owner_id": user.id}
        await self._upsert(DmThread, [row], ["owner_id", "thread_key"])
        await self.session.commit()

    async def delete_owner_thread(self, user: User, thread_key: str) -> None:
        stmt = delete(DmThread).where(DmThread.owner_id == user.id, DmThread.thread_key == thread_key)
        await self.session.execute(stmt)
        await self.session.commit()

    async def get_shared_thread(self, user: User, thread_key: str) -> Optional[SharedDmThread]:
        row = await self._shared_dm_by_key(thread_key)
        if not row:
            return None
        self._require_shared_participant(user, row)
        return row

    async def upsert_shared_thread(self, user: User, payload: SharedDmThreadPayload) -> None:
        existing = await self._shared_dm_by_key(payload.thread_key)
        if existing:
            self._require_shared_participant(user, existing)
        row = self._shared_payload_row(user, payload, existing)
        await self._upsert(SharedDmThread, [row], ["thread_key"])
        await self.session.commit()

    async def delete_shared_thread(self, user: User, thread_key: str) -> None:
        existing = await self._shared_dm_by_key(thread_key)
        if not existing:
            return
        self._require_shared_participant(user, existing)
        await self.session.execute(delete(SharedDmThread).where(SharedDmThread.thread_key == thread_key))
        await self.session.commit()

    async def _shared_dm_by_key(self, thread_key: str) -> Optional[SharedDmThread]:
        result = await self.session.execute(select(SharedDmThread).where(SharedDmThread.thread_key == thread_key))
        return result.scalar_one_or_none()

    def _shared_payload_row(self, user: User, payload: SharedDmThreadPayload, existing: Optional[SharedDmThread]) -> dict[str, object]:
        row = payload.model_dump(mode="python")
        participant_ids = set(existing.participant_user_ids if existing else row.get("participant_user_ids", []))
        participant_ids.add(user.id)
        row["participant_user_ids"] = list(participant_ids)
        row["created_by"] = existing.created_by if existing else user.id
        return row

    def _require_shared_participant(self, user: User, row: SharedDmThread) -> None:
        if user.id not in set(row.participant_user_ids or []):
            raise ForbiddenError("Shared DM participant required")

    async def _upsert(self, model: object, rows: list[dict[str, object]], conflict: list[str]) -> None:
        if not rows:
            return
        stmt = insert(model).values(rows)
        update_columns = {key: stmt.excluded[key] for key in rows[0] if key not in conflict}
        await self.session.execute(stmt.on_conflict_do_update(index_elements=conflict, set_=update_columns))
