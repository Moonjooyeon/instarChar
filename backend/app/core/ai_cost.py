from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


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


def gemini_usage(data: dict[str, object]) -> ProviderUsage:
    usage = _record(data.get("usageMetadata"))
    thought_tokens = _integer(usage.get("thoughtsTokenCount"))
    candidate_tokens = _integer(usage.get("candidatesTokenCount"))
    return ProviderUsage(attempts=1, input_tokens=_integer(usage.get("promptTokenCount")), output_tokens=candidate_tokens, thought_tokens=thought_tokens, total_tokens=_integer(usage.get("totalTokenCount")))


def _record(value: object) -> dict[str, object]:
    return value if isinstance(value, dict) else {}


def _integer(value: object) -> int:
    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return 0
