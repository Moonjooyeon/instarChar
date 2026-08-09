from decimal import Decimal

from app.core.ai_cost import provider_usage, token_cost_usd


def test_provider_usage_includes_thinking_tokens_and_actual_cost() -> None:
    data = {"usageMetadata": {"promptTokenCount": 1000, "candidatesTokenCount": 200, "thoughtsTokenCount": 300, "totalTokenCount": 1500}}
    usage = provider_usage(data, "pro")
    assert usage.attempts == 1
    assert usage.input_tokens == 1000
    assert usage.output_tokens == 200
    assert usage.thought_tokens == 300
    assert usage.total_tokens == 1500
    assert usage.cost_usd == Decimal("0.00625000")
    assert usage.measured is True


def test_flash_token_cost_uses_input_and_output_rates() -> None:
    assert token_cost_usd("flash", 1_000_000, 1_000_000) == Decimal("2.80000000")
