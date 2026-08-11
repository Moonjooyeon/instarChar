from decimal import Decimal

from app.core.ai_cost import gemini_usage


def test_gemini_usage_keeps_candidate_and_thinking_tokens_separate() -> None:
    data = {"usageMetadata": {"promptTokenCount": 1000, "candidatesTokenCount": 500, "thoughtsTokenCount": 300, "totalTokenCount": 1500}}
    usage = gemini_usage(data)
    assert usage.attempts == 1
    assert usage.input_tokens == 1000
    assert usage.output_tokens == 500
    assert usage.thought_tokens == 300
    assert usage.total_tokens == 1500
    assert usage.cost_usd == Decimal("0")
    assert usage.measured is False


def test_gemini_usage_keeps_reservation_without_cost() -> None:
    usage = gemini_usage({"usageMetadata": {"promptTokenCount": 100, "candidatesTokenCount": 20, "totalTokenCount": 120}})
    assert usage.cost_usd == Decimal("0")
    assert usage.measured is False
