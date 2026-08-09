from decimal import Decimal
from uuid import uuid4

from app.core.config import Settings
from app.models import AiDailyUsage, AiMonthlyUsage, CreditUsage
from app.repositories.ai_usage import UsageReservation, _daily_call_limit, _settle_usage_rows, usage_limit_error


def test_usage_limit_blocks_daily_calls() -> None:
    result = usage_limit_error(50, Decimal("0"), Settings(api_daily_limit=50))
    assert result is not None
    assert result.error_code == "DAILY_LIMIT_EXCEEDED"


def test_usage_limit_blocks_projected_monthly_cost() -> None:
    settings = Settings(api_monthly_cost_limit_usd=1, api_estimated_call_cost_usd=0.1)
    result = usage_limit_error(0, Decimal("0.95"), settings)
    assert result is not None
    assert result.error_code == "MONTHLY_COST_LIMIT_EXCEEDED"


def test_usage_limit_allows_new_period_capacity() -> None:
    result = usage_limit_error(0, Decimal("0"), Settings())
    assert result is None


def test_purchased_only_usage_has_separate_daily_safety_limit() -> None:
    usage = CreditUsage(user_id=uuid4(), flow="feed_post", policy_version="v2", model="flash", status="reserved", credits=3, energy_percent=0, bonus_credits=0, purchased_credits=3, idempotency_key="paid-request")
    settings = Settings(api_daily_limit=50, api_paid_daily_limit=200)
    assert _daily_call_limit(settings, usage) == 200
    assert usage_limit_error(50, Decimal("0"), settings, daily_limit=200) is None


def test_bonus_usage_keeps_free_daily_safety_limit() -> None:
    usage = CreditUsage(user_id=uuid4(), flow="feed_post", policy_version="v2", model="flash", status="reserved", credits=3, energy_percent=0, bonus_credits=3, purchased_credits=0, idempotency_key="bonus-request")
    assert _daily_call_limit(Settings(api_daily_limit=50, api_paid_daily_limit=200), usage) == 50


def test_usage_limit_uses_flow_specific_reserved_cost() -> None:
    settings = Settings(api_monthly_cost_limit_usd=1, api_estimated_call_cost_usd=0.01)
    result = usage_limit_error(0, Decimal("0.80"), settings, Decimal("0.25"))
    assert result is not None
    assert result.error_code == "MONTHLY_COST_LIMIT_EXCEEDED"


def test_unmeasured_provider_result_keeps_conservative_reservation() -> None:
    daily = AiDailyUsage(estimated_cost_usd=Decimal("0.25"), actual_cost_usd=Decimal("0"))
    monthly = AiMonthlyUsage(estimated_cost_usd=Decimal("0.25"), actual_cost_usd=Decimal("0"))
    reservation = UsageReservation(True, reserved_cost_usd=Decimal("0.25"))
    _settle_usage_rows(daily, monthly, reservation, Decimal("0"), measured=False)
    assert daily.estimated_cost_usd == Decimal("0.25")
    assert monthly.estimated_cost_usd == Decimal("0.25")
