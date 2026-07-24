from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.models import AiDailyUsage, AiMonthlyUsage


API_LIMIT_MESSAGE = "오늘 설정된 API 사용량을 모두 사용했어. 다음에 다시 만나자."


@dataclass(frozen=True)
class UsageReservation:
    allowed: bool
    error_code: str = ""
    message: str = ""


class AiUsageRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def reserve(self, owner_id: UUID, settings: Settings, now: datetime | None = None) -> UsageReservation:
        current = now or datetime.now(timezone.utc)
        await self._ensure_rows(owner_id, current)
        daily = await self._daily_for_update(owner_id, current)
        monthly = await self._monthly_for_update(current)
        blocked = usage_limit_error(daily.call_count, monthly.estimated_cost_usd, settings)
        if blocked:
            await self.session.commit()
            return blocked
        cost = Decimal(str(settings.api_estimated_call_cost_usd))
        daily.call_count += 1
        daily.estimated_cost_usd += cost
        monthly.call_count += 1
        monthly.estimated_cost_usd += cost
        await self.session.commit()
        return UsageReservation(True)

    async def _ensure_rows(self, owner_id: UUID, now: datetime) -> None:
        daily = insert(AiDailyUsage).values(owner_id=owner_id, usage_date=now.date()).on_conflict_do_nothing()
        monthly = insert(AiMonthlyUsage).values(usage_month=now.strftime("%Y-%m")).on_conflict_do_nothing()
        await self.session.execute(daily)
        await self.session.execute(monthly)

    async def _daily_for_update(self, owner_id: UUID, now: datetime) -> AiDailyUsage:
        stmt = select(AiDailyUsage).where(AiDailyUsage.owner_id == owner_id, AiDailyUsage.usage_date == now.date()).with_for_update()
        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def _monthly_for_update(self, now: datetime) -> AiMonthlyUsage:
        stmt = select(AiMonthlyUsage).where(AiMonthlyUsage.usage_month == now.strftime("%Y-%m")).with_for_update()
        result = await self.session.execute(stmt)
        return result.scalar_one()


def usage_limit_error(daily_count: int, monthly_cost: Decimal, settings: Settings) -> UsageReservation | None:
    if daily_count >= settings.api_daily_limit:
        return UsageReservation(False, "DAILY_LIMIT_EXCEEDED", API_LIMIT_MESSAGE)
    projected = monthly_cost + Decimal(str(settings.api_estimated_call_cost_usd))
    if projected > Decimal(str(settings.api_monthly_cost_limit_usd)):
        return UsageReservation(False, "MONTHLY_COST_LIMIT_EXCEEDED", API_LIMIT_MESSAGE)
    return None
