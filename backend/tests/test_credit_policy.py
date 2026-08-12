from datetime import datetime, timedelta, timezone

import pytest

from app.core.credit_policy import CREDIT_POLICY_VERSION, ENERGY_POLICY_VERSION, FIRST_CHARACTER_BONUS_CREDITS, FIRST_DM_BONUS_CREDITS, SIGNUP_BONUS_CREDITS, daily_period_start, next_daily_reset_at, next_energy_recovery_at, next_monthly_reset_at, recover_energy, resolve_flow, resolve_public_flow, usage_period


def test_energy_recovers_twice_after_twelve_hours() -> None:
    anchor = datetime(2026, 8, 9, tzinfo=timezone.utc)
    percent, recovered_at = recover_energy(20, anchor, anchor + timedelta(hours=13))
    assert percent == 70
    assert recovered_at == anchor + timedelta(hours=12)


def test_full_energy_starts_new_recovery_anchor() -> None:
    anchor = datetime(2026, 8, 9, tzinfo=timezone.utc)
    now = anchor + timedelta(days=2)
    percent, recovered_at = recover_energy(100, anchor, now)
    assert percent == 100
    assert recovered_at == now
    assert next_energy_recovery_at(percent, recovered_at) is None


def test_recovery_time_does_not_accumulate_after_reaching_full() -> None:
    anchor = datetime(2026, 8, 9, tzinfo=timezone.utc)
    now = anchor + timedelta(hours=13)
    percent, recovered_at = recover_energy(80, anchor, now)
    assert percent == 100
    assert recovered_at == now
    assert next_energy_recovery_at(92, recovered_at) == now + timedelta(hours=6)


def test_daily_usage_resets_at_korean_midnight() -> None:
    before_reset = datetime(2026, 8, 9, 14, 59, tzinfo=timezone.utc)
    after_reset = datetime(2026, 8, 9, 15, 0, tzinfo=timezone.utc)
    assert usage_period(before_reset)[0].isoformat() == "2026-08-09"
    assert usage_period(after_reset)[0].isoformat() == "2026-08-10"
    assert daily_period_start(after_reset) == after_reset
    assert next_daily_reset_at(before_reset) == after_reset


def test_monthly_usage_resets_at_first_day_korean_midnight() -> None:
    before_reset = datetime(2026, 8, 31, 14, 59, tzinfo=timezone.utc)
    after_reset = datetime(2026, 8, 31, 15, 0, tzinfo=timezone.utc)
    assert usage_period(before_reset)[1] == "2026-08"
    assert usage_period(after_reset)[1] == "2026-09"
    assert next_monthly_reset_at(before_reset) == after_reset


def test_onboarding_bonus_policy_totals_150_credits() -> None:
    assert SIGNUP_BONUS_CREDITS + FIRST_CHARACTER_BONUS_CREDITS + FIRST_DM_BONUS_CREDITS == 150
    assert CREDIT_POLICY_VERSION == "credit-2026-08-v7"
    assert ENERGY_POLICY_VERSION == "energy-2026-08-v2"


def test_server_flow_catalog_owns_cost_and_model() -> None:
    assert resolve_flow("direct_dm_basic").credits == 1
    assert resolve_flow("direct_dm_basic").model == "flash"
    assert resolve_flow("direct_dm_basic").max_input_chars == 12000
    assert resolve_flow("character_analysis").credits == 5
    assert resolve_flow("character_analysis").model == "pro"
    assert resolve_flow("character_analysis").intro_free_uses == 1
    assert resolve_flow("character-feed-post-v1").credits == 3


def test_unknown_flow_is_rejected_instead_of_becoming_free() -> None:
    with pytest.raises(ValueError, match="지원하지 않는"):
        resolve_flow("made-up-free-flow")


def test_internal_flows_are_not_public() -> None:
    with pytest.raises(ValueError, match="공개 API"):
        resolve_public_flow("internal")


def test_auto_feed_flow_uses_discounted_purchased_credits() -> None:
    policy = resolve_flow("auto_feed_post")
    assert (policy.credits, policy.energy_percent, policy.free_daily_limit, policy.hard_daily_limit) == (2, 0, 24, 24)
    assert policy.energy_allowed is False
    assert policy.bonus_allowed is False
    with pytest.raises(ValueError, match="공개 API"):
        resolve_public_flow("auto_feed_post")


def test_free_assist_flows_have_conservative_daily_limits() -> None:
    assert resolve_flow("assist_social").hard_daily_limit == 12
    assert resolve_flow("assist_relationship").hard_daily_limit == 6
    assert resolve_flow("assist_session").hard_daily_limit == 4


def test_pro_flows_disable_energy_and_bonus() -> None:
    policy = resolve_public_flow("direct_dm_pro")
    assert policy.credits == 5
    assert policy.energy_allowed is False
    assert policy.bonus_allowed is False
    assert policy.hard_daily_limit == 20


def test_conversation_tiers_use_three_clear_prices() -> None:
    assert resolve_public_flow("direct_dm_context").credits == 2
    assert resolve_public_flow("direct_dm_pro").credits == 5


def test_conversation_tiers_limit_output_by_their_purchased_depth() -> None:
    assert resolve_public_flow("direct_dm_basic").max_output_tokens == 512
    assert resolve_public_flow("direct_dm_context").max_output_tokens == 768
    assert resolve_public_flow("direct_dm_pro").max_output_tokens == 1536
