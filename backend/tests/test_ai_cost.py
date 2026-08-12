from decimal import Decimal

from app.core.ai_cost import gemini_usage


def test_gemini_usage_keeps_candidate_and_thinking_tokens_separate() -> None:
    data = {"usageMetadata": {"promptTokenCount": 1000, "candidatesTokenCount": 500, "thoughtsTokenCount": 300, "totalTokenCount": 1500}}
    usage = gemini_usage(data, "gemini-3.6-flash", Decimal("1.5"), Decimal("7.5"))
    assert usage.attempts == 1
    assert usage.input_tokens == 1000
    assert usage.output_tokens == 500
    assert usage.thought_tokens == 300
    assert usage.total_tokens == 1500
    assert usage.model == "gemini-3.6-flash"
    assert usage.cost_usd == Decimal("0.0075")
    assert usage.measured is True


def test_gemini_usage_calculates_cost_without_thinking_tokens() -> None:
    usage = gemini_usage({"usageMetadata": {"promptTokenCount": 100, "candidatesTokenCount": 20, "totalTokenCount": 120}}, "gemini-3.6-flash", Decimal("1.5"), Decimal("7.5"))
    assert usage.cost_usd == Decimal("0.0003")
    assert usage.measured is True
