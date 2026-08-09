from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


MILLION = Decimal(1_000_000)


@dataclass(frozen=True)
class ProviderUsage:
    attempts: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    thought_tokens: int = 0
    total_tokens: int = 0
    cost_usd: Decimal = Decimal("0")
    measured: bool = False

    def merged(self, other: ProviderUsage) -> ProviderUsage:
        return ProviderUsage(attempts=self.attempts + other.attempts, input_tokens=self.input_tokens + other.input_tokens, output_tokens=self.output_tokens + other.output_tokens, thought_tokens=self.thought_tokens + other.thought_tokens, total_tokens=self.total_tokens + other.total_tokens, cost_usd=self.cost_usd + other.cost_usd, measured=self.measured and other.measured)


def provider_usage(data: dict[str, object], model: str) -> ProviderUsage:
    metadata = _record(data.get("usageMetadata"))
    input_tokens = _integer(metadata.get("promptTokenCount"))
    output_tokens = _integer(metadata.get("candidatesTokenCount"))
    thought_tokens = _integer(metadata.get("thoughtsTokenCount"))
    total_tokens = _integer(metadata.get("totalTokenCount"))
    cost = token_cost_usd(model, input_tokens, output_tokens + thought_tokens)
    return ProviderUsage(1, input_tokens, output_tokens, thought_tokens, total_tokens, cost, isinstance(data.get("usageMetadata"), dict))


def token_cost_usd(model: str, input_tokens: int, output_tokens: int) -> Decimal:
    input_rate, output_rate = _rates(model)
    cost = (Decimal(input_tokens) * input_rate + Decimal(output_tokens) * output_rate) / MILLION
    return cost.quantize(Decimal("0.00000001"))


def _rates(model: str) -> tuple[Decimal, Decimal]:
    if model == "pro":
        return Decimal("1.25"), Decimal("10.00")
    return Decimal("0.30"), Decimal("2.50")


def _record(value: object) -> dict[str, object]:
    return value if isinstance(value, dict) else {}


def _integer(value: object) -> int:
    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return 0
