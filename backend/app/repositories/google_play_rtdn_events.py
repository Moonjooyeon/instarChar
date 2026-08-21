from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from sqlalchemy import and_, or_, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import GooglePlayRtdnEvent


STALE_PROCESSING_AFTER = timedelta(minutes=10)


class GooglePlayRtdnEventsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def claim(self, message_id: str, notification_type: str, purchase_token: str) -> UUID | None:
        claimed_at = datetime.now(timezone.utc)
        event_id = await self._insert(message_id, notification_type, purchase_token, claimed_at)
        if event_id:
            await self.session.commit()
            return event_id
        event_id = await self._retry(message_id, claimed_at)
        await self.session.commit()
        return event_id

    async def complete(self, event_id: UUID, status: str) -> None:
        values = {"status": status, "processed_at": datetime.now(timezone.utc), "failure_reason": ""}
        await self.session.execute(update(GooglePlayRtdnEvent).where(GooglePlayRtdnEvent.id == event_id).values(values))
        await self.session.commit()

    async def fail(self, event_id: UUID, reason: str) -> None:
        values = {"status": "failed", "failure_reason": reason[:255]}
        await self.session.execute(update(GooglePlayRtdnEvent).where(GooglePlayRtdnEvent.id == event_id).values(values))
        await self.session.commit()

    async def _insert(self, message_id: str, notification_type: str, purchase_token: str, claimed_at: datetime) -> UUID | None:
        values = {"id": uuid4(), "message_id": message_id, "notification_type": notification_type, "purchase_token": purchase_token, "claimed_at": claimed_at}
        statement = insert(GooglePlayRtdnEvent).values(values).on_conflict_do_nothing(index_elements=[GooglePlayRtdnEvent.message_id]).returning(GooglePlayRtdnEvent.id)
        return (await self.session.execute(statement)).scalar_one_or_none()

    async def _retry(self, message_id: str, claimed_at: datetime) -> UUID | None:
        stale = GooglePlayRtdnEvent.claimed_at < claimed_at - STALE_PROCESSING_AFTER
        claimable = or_(GooglePlayRtdnEvent.status == "failed", and_(GooglePlayRtdnEvent.status == "processing", stale))
        values = {"status": "processing", "claimed_at": claimed_at, "failure_reason": ""}
        statement = update(GooglePlayRtdnEvent).where(GooglePlayRtdnEvent.message_id == message_id, claimable).values(values).returning(GooglePlayRtdnEvent.id)
        return (await self.session.execute(statement)).scalar_one_or_none()
