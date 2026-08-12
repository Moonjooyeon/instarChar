from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo


CREDIT_POLICY_VERSION = "credit-2026-08-v7"
ENERGY_POLICY_VERSION = "energy-2026-08-v2"
ENERGY_MAX_PERCENT = 100
ENERGY_RECOVERY_PERCENT = 25
ENERGY_RECOVERY_HOURS = 6
SIGNUP_BONUS_CREDITS = 50
FIRST_CHARACTER_BONUS_CREDITS = 50
FIRST_DM_BONUS_CREDITS = 50
REWARD_MISSIONS = (("signup", SIGNUP_BONUS_CREDITS), ("first_character", FIRST_CHARACTER_BONUS_CREDITS), ("first_dm", FIRST_DM_BONUS_CREDITS))
USAGE_TIMEZONE = ZoneInfo("Asia/Seoul")


@dataclass(frozen=True)
class FlowPolicy:
    code: str
    credits: int
    energy_percent: int
    model: str
    label: str
    max_input_chars: int
    max_output_tokens: int
    thinking_budget: int
    free_daily_limit: int
    public: bool = True
    energy_allowed: bool = True
    bonus_allowed: bool = True
    hard_daily_limit: int = 0
    intro_free_uses: int = 0


FLOW_POLICIES: dict[str, FlowPolicy] = {
    "direct_dm_basic": FlowPolicy("direct_dm_basic", 1, 8, "flash", "기본 대화", 12000, 512, 0, 50),
    "direct_dm_context": FlowPolicy("direct_dm_context", 2, 15, "flash", "기억 반영", 24000, 768, 256, 50),
    "direct_dm_pro": FlowPolicy("direct_dm_pro", 5, 25, "pro", "중요한 답장", 24000, 1536, 256, 20, energy_allowed=False, bonus_allowed=False, hard_daily_limit=20),
    "feed_post": FlowPolicy("feed_post", 3, 20, "flash", "피드 글 생성", 20000, 1200, 256, 30),
    "character_interaction": FlowPolicy("character_interaction", 5, 25, "flash", "캐릭터 상호작용", 30000, 2048, 512, 20),
    "assist_social": FlowPolicy("assist_social", 0, 0, "flash", "SNS 보조 생성", 6000, 256, 0, 12, hard_daily_limit=12),
    "assist_relationship": FlowPolicy("assist_relationship", 0, 0, "flash", "관계 보조 처리", 8000, 256, 0, 6, hard_daily_limit=6),
    "assist_session": FlowPolicy("assist_session", 0, 0, "flash", "대화 정리", 20000, 2048, 256, 4, hard_daily_limit=4),
    "character_analysis": FlowPolicy("character_analysis", 5, 0, "pro", "캐릭터 분석", 50000, 4096, 1024, 3, energy_allowed=False, bonus_allowed=False, hard_daily_limit=3, intro_free_uses=1),
    "auto_feed_post": FlowPolicy("auto_feed_post", 2, 0, "flash", "혼자 남기는 근황", 20000, 1200, 256, 24, public=False, energy_allowed=False, bonus_allowed=False, hard_daily_limit=24),
    "internal": FlowPolicy("internal", 0, 0, "flash", "내부 처리", 40000, 2048, 0, 0, public=False),
    "internal_pro": FlowPolicy("internal_pro", 0, 0, "pro", "내부 고품질 처리", 50000, 4096, 1024, 0, public=False),
}

FLOW_ALIASES = {
    "character-feed-post-v1": "feed_post",
    "character-analysis-v2": "internal_pro",
}


def resolve_flow(flow: str) -> FlowPolicy:
    normalized = flow.strip().lower()
    code = FLOW_ALIASES.get(normalized, normalized)
    if code not in FLOW_POLICIES:
        raise ValueError("지원하지 않는 AI flow야.")
    return FLOW_POLICIES[code]


def resolve_public_flow(flow: str) -> FlowPolicy:
    policy = resolve_flow(flow)
    if not policy.public:
        raise ValueError("공개 API에서 사용할 수 없는 AI flow야.")
    return policy


def maximum_provider_cost_usd(policy: FlowPolicy, attempts: int = 2) -> Decimal:
    input_rate, output_rate = _model_rates(policy.model)
    input_tokens = Decimal(policy.max_input_chars * 2)
    output_tokens = Decimal(policy.max_output_tokens)
    single = (input_tokens * input_rate + output_tokens * output_rate) / Decimal(1_000_000)
    return single * attempts


def _model_rates(model: str) -> tuple[Decimal, Decimal]:
    if model == "pro":
        return Decimal("2.00"), Decimal("12.00")
    return Decimal("1.50"), Decimal("7.50")


def recover_energy(percent: int, last_recovered_at: datetime, now: datetime) -> tuple[int, datetime]:
    current = max(0, min(percent, ENERGY_MAX_PERCENT))
    anchor = last_recovered_at.astimezone(timezone.utc)
    current_time = now.astimezone(timezone.utc)
    if current >= ENERGY_MAX_PERCENT:
        return ENERGY_MAX_PERCENT, current_time
    intervals = int((current_time - anchor).total_seconds()) // (ENERGY_RECOVERY_HOURS * 3600)
    if intervals <= 0:
        return current, anchor
    intervals_to_full = (ENERGY_MAX_PERCENT - current + ENERGY_RECOVERY_PERCENT - 1) // ENERGY_RECOVERY_PERCENT
    if intervals >= intervals_to_full:
        return ENERGY_MAX_PERCENT, current_time
    next_percent = min(ENERGY_MAX_PERCENT, current + intervals * ENERGY_RECOVERY_PERCENT)
    return next_percent, anchor + timedelta(hours=ENERGY_RECOVERY_HOURS * intervals)


def next_energy_recovery_at(percent: int, last_recovered_at: datetime) -> datetime | None:
    if percent >= ENERGY_MAX_PERCENT:
        return None
    return last_recovered_at.astimezone(timezone.utc) + timedelta(hours=ENERGY_RECOVERY_HOURS)


def usage_period(now: datetime) -> tuple[date, str]:
    local = now.astimezone(USAGE_TIMEZONE)
    return local.date(), local.strftime("%Y-%m")


def daily_period_start(now: datetime) -> datetime:
    local = now.astimezone(USAGE_TIMEZONE)
    return local.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)


def next_daily_reset_at(now: datetime) -> datetime:
    return daily_period_start(now) + timedelta(days=1)


def next_monthly_reset_at(now: datetime) -> datetime:
    local = now.astimezone(USAGE_TIMEZONE)
    year = local.year + 1 if local.month == 12 else local.year
    month = 1 if local.month == 12 else local.month + 1
    return local.replace(year=year, month=month, day=1, hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
