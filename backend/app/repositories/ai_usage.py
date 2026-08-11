from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.credit_policy import usage_period
from app.models import AiDailyUsage, AiMonthlyUsage, CreditUsage


API_LIMIT_MESSAGE = "오늘 설정된 API 사용량을 모두 사용했어. 다음에 다시 만나자."


@dataclass(frozen=True)
class UsageReservation:
    allowed: bool
    error_code: str = ""
    message: str = ""
    reserved_cost_usd: Decimal = Decimal("0")
    usage_date: date | None = None
    usage_month: str = ""


class AiUsageRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def reserve(self, owner_id: UUID, settings: Settings, reserved_cost_usd: Decimal | None = None, now: datetime | None = None, credit_usage_id: UUID | None = None) -> UsageReservation:
        current = now or datetime.now(timezone.utc)
        reserved = reserved_cost_usd or Decimal(str(settings.api_estimated_call_cost_usd))
        credit_usage = await self._credit_usage_for_update(owner_id, credit_usage_id)
        usage_date, month = usage_period(current)
        await self._ensure_rows(owner_id, usage_date, month)
        daily = await self._daily_for_update(owner_id, usage_date)
        monthly = await self._monthly_for_update(month)
        daily_limit = _daily_call_limit(settings, credit_usage)
        blocked = usage_limit_error(daily.call_count, monthly.estimated_cost_usd, settings, reserved, daily_limit)
        if blocked:
            await self.session.commit()
            return blocked
        _apply_reservation(daily, monthly, credit_usage, reserved)
        await self.session.commit()
        return UsageReservation(True, reserved_cost_usd=reserved, usage_date=usage_date, usage_month=month)

    async def settle(self, owner_id: UUID, reservation: UsageReservation, actual_cost_usd: Decimal, measured: bool = True) -> None:
        if not reservation.usage_date or not reservation.usage_month:
            return
        daily = await self._daily_for_update(owner_id, reservation.usage_date)
        monthly = await self._monthly_for_update(reservation.usage_month)
        _settle_usage_rows(daily, monthly, reservation, actual_cost_usd, measured)
        await self.session.commit()

    async def _ensure_rows(self, owner_id: UUID, usage_date: date, usage_month: str) -> None:
        daily = insert(AiDailyUsage).values(owner_id=owner_id, usage_date=usage_date).on_conflict_do_nothing()
        monthly = insert(AiMonthlyUsage).values(usage_month=usage_month).on_conflict_do_nothing()
        await self.session.execute(daily)
        await self.session.execute(monthly)

    async def _daily_for_update(self, owner_id: UUID, usage_date: date) -> AiDailyUsage:
        stmt = select(AiDailyUsage).where(AiDailyUsage.owner_id == owner_id, AiDailyUsage.usage_date == usage_date).with_for_update()
        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def _monthly_for_update(self, usage_month: str) -> AiMonthlyUsage:
        stmt = select(AiMonthlyUsage).where(AiMonthlyUsage.usage_month == usage_month).with_for_update()
        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def _credit_usage_for_update(self, owner_id: UUID, usage_id: UUID | None) -> CreditUsage | None:
        if not usage_id:
            return None
        stmt = select(CreditUsage).where(CreditUsage.id == usage_id, CreditUsage.user_id == owner_id).with_for_update()
        return (await self.session.execute(stmt)).scalar_one_or_none()


def usage_limit_error(daily_count: int, monthly_cost: Decimal, settings: Settings, reserved_cost_usd: Decimal | None = None, daily_limit: int | None = None) -> UsageReservation | None:
    limit = settings.api_daily_limit if daily_limit is None else daily_limit
    if daily_count >= limit:
        return UsageReservation(False, "DAILY_LIMIT_EXCEEDED", API_LIMIT_MESSAGE)
    reserved = reserved_cost_usd or Decimal(str(settings.api_estimated_call_cost_usd))
    projected = monthly_cost + reserved
    if projected > Decimal(str(settings.api_monthly_cost_limit_usd)):
        return UsageReservation(False, "MONTHLY_COST_LIMIT_EXCEEDED", API_LIMIT_MESSAGE)
    return None


def _daily_call_limit(settings: Settings, usage: CreditUsage | None) -> int:
    if usage and usage.purchased_credits > 0 and usage.bonus_credits == 0 and usage.energy_percent == 0:
        return settings.api_paid_daily_limit
    return settings.api_daily_limit


def _settled_estimate(current: Decimal, reserved: Decimal, actual: Decimal) -> Decimal:
    return max(Decimal("0"), current - reserved + actual)


def _apply_reservation(daily: AiDailyUsage, monthly: AiMonthlyUsage, credit_usage: CreditUsage | None, reserved: Decimal) -> None:
    daily.call_count += 1
    daily.estimated_cost_usd += reserved
    monthly.call_count += 1
    monthly.estimated_cost_usd += reserved
    if credit_usage:
        credit_usage.reserved_cost_usd = reserved
        credit_usage.provider_status = "cost_reserved"


def _settle_usage_rows(daily: AiDailyUsage, monthly: AiMonthlyUsage, reservation: UsageReservation, actual: Decimal, measured: bool) -> None:
    if measured:
        daily.estimated_cost_usd = _settled_estimate(daily.estimated_cost_usd, reservation.reserved_cost_usd, actual)
        monthly.estimated_cost_usd = _settled_estimate(monthly.estimated_cost_usd, reservation.reserved_cost_usd, actual)
    daily.actual_cost_usd += actual
    monthly.actual_cost_usd += actual
