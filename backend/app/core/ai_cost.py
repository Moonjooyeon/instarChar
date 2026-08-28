from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class ProviderUsage:
    model: str = ""
    attempts: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    thought_tokens: int = 0
    total_tokens: int = 0
    cost_usd: Decimal = Decimal("0")
    measured: bool = False

    def merged(self, other: ProviderUsage) -> ProviderUsage:
        model = self.model if self.model == other.model or not other.model else f"{self.model}->{other.model}".strip("->")
        return ProviderUsage(model=model, attempts=self.attempts + other.attempts, input_tokens=self.input_tokens + other.input_tokens, output_tokens=self.output_tokens + other.output_tokens, thought_tokens=self.thought_tokens + other.thought_tokens, total_tokens=self.total_tokens + other.total_tokens, cost_usd=self.cost_usd + other.cost_usd, measured=self.measured and other.measured)


def gemini_usage(data: dict[str, object], model: str, input_rate: Decimal, output_rate: Decimal) -> ProviderUsage:
    usage = _record(data.get("usageMetadata"))
    input_tokens = _integer(usage.get("promptTokenCount"))
    thought_tokens = _integer(usage.get("thoughtsTokenCount"))
    output_tokens = _integer(usage.get("candidatesTokenCount"))
    cost = _cost_usd(input_tokens, output_tokens + thought_tokens, input_rate, output_rate)
    measured = bool(usage) and "promptTokenCount" in usage and "totalTokenCount" in usage
    return ProviderUsage(model=model, attempts=1, input_tokens=input_tokens, output_tokens=output_tokens, thought_tokens=thought_tokens, total_tokens=_integer(usage.get("totalTokenCount")), cost_usd=cost, measured=measured)


def openai_usage(data: dict[str, object], model: str, input_rate: Decimal, output_rate: Decimal) -> ProviderUsage:
    usage = _record(data.get("usage"))
    input_tokens = _integer(usage.get("prompt_tokens"))
    output_tokens = _integer(usage.get("completion_tokens"))
    total_tokens = _integer(usage.get("total_tokens"))
    cost = _cost_usd(input_tokens, output_tokens, input_rate, output_rate)
    measured = bool(usage) and "prompt_tokens" in usage and "total_tokens" in usage
    return ProviderUsage(model=model, attempts=1, input_tokens=input_tokens, output_tokens=output_tokens, total_tokens=total_tokens, cost_usd=cost, measured=measured)


def _cost_usd(input_tokens: int, output_tokens: int, input_rate: Decimal, output_rate: Decimal) -> Decimal:
    numerator = Decimal(input_tokens) * input_rate + Decimal(output_tokens) * output_rate
    return numerator / Decimal(1_000_000)


def _record(value: object) -> dict[str, object]:
    return value if isinstance(value, dict) else {}


def _integer(value: object) -> int:
    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return 0
