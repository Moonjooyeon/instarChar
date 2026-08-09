from datetime import datetime, timedelta, timezone

import pytest

from app.core.credit_policy import next_energy_recovery_at, recover_energy, resolve_flow, resolve_public_flow


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


def test_server_flow_catalog_owns_cost_and_model() -> None:
    assert resolve_flow("direct_dm_basic").credits == 1
    assert resolve_flow("direct_dm_basic").model == "flash"
    assert resolve_flow("direct_dm_basic").max_input_chars == 12000
    assert resolve_flow("character-analysis-v2").credits == 0
    assert resolve_flow("character-analysis-v2").model == "pro"
    assert resolve_flow("character-feed-post-v1").credits == 3


def test_unknown_flow_is_rejected_instead_of_becoming_free() -> None:
    with pytest.raises(ValueError, match="지원하지 않는"):
        resolve_flow("made-up-free-flow")


def test_internal_flows_are_not_public() -> None:
    with pytest.raises(ValueError, match="공개 API"):
        resolve_public_flow("internal")


def test_pro_flows_disable_energy_and_bonus() -> None:
    policy = resolve_public_flow("direct_dm_pro")
    assert policy.energy_allowed is False
    assert policy.bonus_allowed is False
