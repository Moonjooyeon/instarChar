from app.core.config import Settings


def test_iap_reconciliation_is_disabled_by_default() -> None:
    settings = Settings(_env_file=None)
    assert settings.toss_iap_enabled is False
    assert settings.toss_iap_purchase_enabled is False
    assert settings.toss_iap_purchase_rollout_percent == 0
    assert settings.toss_iap_reconciliation_enabled is False
    assert settings.toss_iap_reconciliation_poll_seconds == 3600
    assert settings.toss_iap_reconciliation_batch_size == 50
