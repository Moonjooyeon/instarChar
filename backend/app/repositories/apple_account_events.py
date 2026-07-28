from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AppleAccountEvent


class AppleAccountEventsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def claim(self, event_id: str, event_type: str, subject: str, payload_hash: str) -> UUID | None:
        values = {"id": uuid4(), "event_id": event_id, "event_type": event_type, "subject": subject, "payload_hash": payload_hash}
        statement = insert(AppleAccountEvent).values(values).on_conflict_do_nothing(index_elements=["event_id"]).returning(AppleAccountEvent.id)
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def complete(self, event_id: UUID, status: str) -> None:
        values = {"status": status, "processed_at": datetime.now(timezone.utc)}
        await self.session.execute(update(AppleAccountEvent).where(AppleAccountEvent.id == event_id).values(values))
