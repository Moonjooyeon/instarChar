from decimal import Decimal

from app.core.config import Settings
from app.repositories.ai_usage import usage_limit_error


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
