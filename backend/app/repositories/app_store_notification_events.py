from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from sqlalchemy import and_, or_, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AppStoreNotificationEvent


STALE_PROCESSING_AFTER = timedelta(minutes=10)


class AppStoreNotificationEventsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def claim(self, notification_uuid: str, notification_type: str, transaction_id: str) -> UUID | None:
        claimed_at = datetime.now(timezone.utc)
        event_id = await self._insert(notification_uuid, notification_type, transaction_id, claimed_at)
        if event_id:
            await self.session.commit()
            return event_id
        event_id = await self._retry(notification_uuid, claimed_at)
        await self.session.commit()
        return event_id

    async def complete(self, event_id: UUID, status: str) -> None:
        values = {"status": status, "processed_at": datetime.now(timezone.utc), "failure_reason": ""}
        await self.session.execute(update(AppStoreNotificationEvent).where(AppStoreNotificationEvent.id == event_id).values(values))
        await self.session.commit()

    async def fail(self, event_id: UUID, reason: str) -> None:
        values = {"status": "failed", "failure_reason": reason[:255]}
        await self.session.execute(update(AppStoreNotificationEvent).where(AppStoreNotificationEvent.id == event_id).values(values))
        await self.session.commit()

    async def _insert(self, notification_uuid: str, notification_type: str, transaction_id: str, claimed_at: datetime) -> UUID | None:
        values = {"id": uuid4(), "notification_uuid": notification_uuid, "notification_type": notification_type, "transaction_id": transaction_id, "claimed_at": claimed_at}
        statement = insert(AppStoreNotificationEvent).values(values).on_conflict_do_nothing(index_elements=[AppStoreNotificationEvent.notification_uuid]).returning(AppStoreNotificationEvent.id)
        return (await self.session.execute(statement)).scalar_one_or_none()

    async def _retry(self, notification_uuid: str, claimed_at: datetime) -> UUID | None:
        stale = AppStoreNotificationEvent.claimed_at < claimed_at - STALE_PROCESSING_AFTER
        claimable = or_(AppStoreNotificationEvent.status == "failed", and_(AppStoreNotificationEvent.status == "processing", stale))
        values = {"status": "processing", "claimed_at": claimed_at, "failure_reason": ""}
        statement = update(AppStoreNotificationEvent).where(AppStoreNotificationEvent.notification_uuid == notification_uuid, claimable).values(values).returning(AppStoreNotificationEvent.id)
        return (await self.session.execute(statement)).scalar_one_or_none()
