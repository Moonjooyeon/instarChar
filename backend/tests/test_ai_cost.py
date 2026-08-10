from decimal import Decimal

from app.core.ai_cost import openrouter_usage


def test_provider_usage_includes_thinking_tokens_and_actual_cost() -> None:
    data = {"usage": {"prompt_tokens": 1000, "completion_tokens": 500, "completion_tokens_details": {"reasoning_tokens": 300}, "total_tokens": 1500, "cost": 0.00625}}
    usage = openrouter_usage(data)
    assert usage.attempts == 1
    assert usage.input_tokens == 1000
    assert usage.output_tokens == 200
    assert usage.thought_tokens == 300
    assert usage.total_tokens == 1500
    assert usage.cost_usd == Decimal("0.00625")
    assert usage.measured is True


def test_provider_usage_keeps_reservation_when_cost_is_missing() -> None:
    usage = openrouter_usage({"usage": {"prompt_tokens": 100, "completion_tokens": 20, "total_tokens": 120}})
    assert usage.cost_usd == Decimal("0")
    assert usage.measured is False
