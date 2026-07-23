from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Character


@dataclass(frozen=True)
class ClaimedAutoPost:
    owner_id: UUID
    source_account_id: str


class AutoPostRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def claim_due(self, now: datetime, batch_size: int) -> list[ClaimedAutoPost]:
        result = await self.session.execute(self.due_statement(now, batch_size))
        rows = list(result.scalars().all())
        for row in rows:
            row.next_auto_post_at = now + timedelta(seconds=row.auto_post_interval_seconds)
        await self.session.commit()
        return [ClaimedAutoPost(row.owner_id, row.source_account_id) for row in rows]

    def due_statement(self, now: datetime, batch_size: int) -> object:
        return (
            select(Character)
            .where(
                Character.auto_post_enabled.is_(True),
                Character.next_auto_post_at.is_not(None),
                Character.next_auto_post_at <= now,
            )
            .order_by(Character.next_auto_post_at)
            .limit(batch_size)
            .with_for_update(skip_locked=True)
        )
