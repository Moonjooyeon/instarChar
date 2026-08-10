from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation


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


def openrouter_usage(data: dict[str, object]) -> ProviderUsage:
    usage = _record(data.get("usage"))
    details = _record(usage.get("completion_tokens_details"))
    cost = _decimal(usage.get("cost"))
    thought_tokens = _integer(details.get("reasoning_tokens"))
    output_tokens = max(0, _integer(usage.get("completion_tokens")) - thought_tokens)
    return ProviderUsage(attempts=1, input_tokens=_integer(usage.get("prompt_tokens")), output_tokens=output_tokens, thought_tokens=thought_tokens, total_tokens=_integer(usage.get("total_tokens")), cost_usd=cost or Decimal("0"), measured=cost is not None)


def _record(value: object) -> dict[str, object]:
    return value if isinstance(value, dict) else {}


def _integer(value: object) -> int:
    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return 0


def _decimal(value: object) -> Decimal | None:
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None
    return parsed if parsed >= 0 else None
