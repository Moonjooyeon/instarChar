from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo


CREDIT_POLICY_VERSION = "credit-2026-08-v2"
ENERGY_POLICY_VERSION = "energy-2026-08-v2"
ENERGY_MAX_PERCENT = 100
ENERGY_RECOVERY_PERCENT = 25
ENERGY_RECOVERY_HOURS = 6
SIGNUP_BONUS_CREDITS = 50
FIRST_CHARACTER_BONUS_CREDITS = 50
FIRST_DM_BONUS_CREDITS = 50
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


FLOW_POLICIES: dict[str, FlowPolicy] = {
    "direct_dm_basic": FlowPolicy("direct_dm_basic", 1, 8, "flash", "기본 대화", 12000, 2048, 0, 50),
    "direct_dm_context": FlowPolicy("direct_dm_context", 2, 15, "flash", "문맥형 대화", 24000, 2048, 256, 50),
    "direct_dm_flash_long": FlowPolicy("direct_dm_flash_long", 3, 20, "flash", "긴 대화", 40000, 3072, 512, 50),
    "direct_dm_pro": FlowPolicy("direct_dm_pro", 5, 25, "pro", "Pro 대화", 24000, 2048, 256, 20, energy_allowed=False, bonus_allowed=False, hard_daily_limit=20),
    "direct_dm_pro_story": FlowPolicy("direct_dm_pro_story", 7, 30, "pro", "Pro 서사형", 50000, 4096, 1024, 10, energy_allowed=False, bonus_allowed=False, hard_daily_limit=10),
    "feed_post": FlowPolicy("feed_post", 3, 20, "flash", "피드 글 생성", 20000, 1200, 256, 30),
    "image_understanding": FlowPolicy("image_understanding", 5, 30, "flash", "이미지 이해", 20000, 2048, 256, 20),
    "character_interaction": FlowPolicy("character_interaction", 5, 25, "flash", "캐릭터 상호작용", 30000, 2048, 512, 20),
    "assist_social": FlowPolicy("assist_social", 0, 0, "flash", "SNS 보조 생성", 6000, 256, 0, 20),
    "assist_relationship": FlowPolicy("assist_relationship", 0, 0, "flash", "관계 보조 처리", 8000, 256, 0, 10),
    "assist_session": FlowPolicy("assist_session", 0, 0, "flash", "대화 정리", 20000, 2048, 256, 12),
    "character_analysis": FlowPolicy("character_analysis", 0, 0, "pro", "캐릭터 분석", 50000, 4096, 1024, 3),
    "auto_feed_post": FlowPolicy("auto_feed_post", 0, 0, "flash", "무료 자동 게시", 20000, 1200, 256, 24, public=False),
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
        return Decimal("1.25"), Decimal("10.00")
    return Decimal("0.30"), Decimal("2.50")


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
