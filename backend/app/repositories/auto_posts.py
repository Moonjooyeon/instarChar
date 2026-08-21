from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Character


AUTO_POST_CLAIM_LEASE = timedelta(minutes=15)


@dataclass(frozen=True)
class ClaimedAutoPost:
    owner_id: UUID
    source_account_id: str
    scheduled_for: datetime
    claimed_at: datetime
    failure_count: int


class AutoPostRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def claim_next(self, now: datetime) -> ClaimedAutoPost | None:
        result = await self.session.execute(self.due_statement(now))
        row = result.scalar_one_or_none()
        claim = self._claim(row, now) if row else None
        await self.session.commit()
        return claim

    def due_statement(self, now: datetime) -> object:
        stale_before = now - AUTO_POST_CLAIM_LEASE
        return (
            select(Character)
            .where(
                Character.auto_post_enabled.is_(True),
                Character.next_auto_post_at.is_not(None),
                Character.next_auto_post_at <= now,
                or_(Character.auto_post_claimed_at.is_(None), Character.auto_post_claimed_at <= stale_before),
            )
            .order_by(Character.next_auto_post_at)
            .limit(1)
            .with_for_update(skip_locked=True)
        )

    def _claim(self, row: Character, claimed_at: datetime) -> ClaimedAutoPost:
        scheduled_for = row.next_auto_post_at
        if scheduled_for is None:
            raise RuntimeError("Due auto-post has no scheduled time")
        row.auto_post_claimed_at = claimed_at
        return ClaimedAutoPost(row.owner_id, row.source_account_id, scheduled_for, claimed_at, row.auto_post_failure_count)
