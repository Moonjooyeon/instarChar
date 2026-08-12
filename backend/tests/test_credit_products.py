from pathlib import Path

import pytest

from app.core.config import Settings
from app.core.credit_products import CREDIT_PRODUCTS, toss_iap_purchase_available, validate_toss_iap_configuration
from app.models import UserProvider


def test_complete_toss_iap_configuration_is_valid(tmp_path: Path) -> None:
    validate_toss_iap_configuration(_configured_settings(tmp_path))


def test_credit_products_match_registered_console_prices() -> None:
    prices = [(product.supply_price_krw, product.price_krw) for product in CREDIT_PRODUCTS]
    assert prices == [(4900, 5390), (9900, 10890), (29500, 32450), (49500, 54450), (99000, 108900)]


def test_purchase_flag_requires_main_integration_flag() -> None:
    settings = Settings(_env_file=None, toss_iap_purchase_enabled=True)
    with pytest.raises(ValueError, match="TOSS_IAP_ENABLED"):
        validate_toss_iap_configuration(settings)


def test_toss_iap_configuration_requires_unique_skus(tmp_path: Path) -> None:
    settings = _configured_settings(tmp_path)
    settings.toss_iap_credit_10000_sku = settings.toss_iap_credit_5000_sku
    with pytest.raises(ValueError, match="must be unique"):
        validate_toss_iap_configuration(settings)


def test_toss_iap_configuration_requires_every_sku(tmp_path: Path) -> None:
    settings = _configured_settings(tmp_path)
    settings.toss_iap_credit_100000_sku = ""
    with pytest.raises(ValueError, match="must be present"):
        validate_toss_iap_configuration(settings)


def test_toss_iap_configuration_requires_stable_hmac_key(tmp_path: Path) -> None:
    settings = _configured_settings(tmp_path)
    settings.toss_iap_subject_hmac_key = ""
    with pytest.raises(ValueError, match="TOSS_IAP_SUBJECT_HMAC_KEY"):
        validate_toss_iap_configuration(settings)


def test_toss_iap_configuration_rejects_auth_secret_reuse(tmp_path: Path) -> None:
    settings = _configured_settings(tmp_path)
    settings.auth_secret_key = settings.toss_iap_subject_hmac_key
    with pytest.raises(ValueError, match="separate from AUTH_SECRET_KEY"):
        validate_toss_iap_configuration(settings)


def test_toss_iap_configuration_requires_mtls_files(tmp_path: Path) -> None:
    settings = _configured_settings(tmp_path)
    settings.toss_mtls_cert_path = str(tmp_path / "missing.pem")
    with pytest.raises(ValueError, match="TOSS_MTLS_CERT_PATH"):
        validate_toss_iap_configuration(settings)


def test_toss_iap_configuration_rejects_invalid_rollout(tmp_path: Path) -> None:
    settings = _configured_settings(tmp_path)
    settings.toss_iap_purchase_rollout_percent = 101
    with pytest.raises(ValueError, match="ROLLOUT_PERCENT"):
        validate_toss_iap_configuration(settings)


def test_audit_alerts_require_reconciliation(tmp_path: Path) -> None:
    settings = _configured_settings(tmp_path)
    settings.toss_iap_audit_alerts_enabled = True
    with pytest.raises(ValueError, match="RECONCILIATION_ENABLED"):
        validate_toss_iap_configuration(settings)


def test_purchases_require_reconciliation(tmp_path: Path) -> None:
    settings = _configured_settings(tmp_path)
    settings.toss_iap_purchase_enabled = True
    with pytest.raises(ValueError, match="RECONCILIATION_ENABLED"):
        validate_toss_iap_configuration(settings)


def test_purchases_require_audit_alerts(tmp_path: Path) -> None:
    settings = _configured_settings(tmp_path)
    settings.toss_iap_purchase_enabled = True
    settings.toss_iap_reconciliation_enabled = True
    with pytest.raises(ValueError, match="AUDIT_ALERTS_ENABLED"):
        validate_toss_iap_configuration(settings)


def test_purchase_rollout_requires_toss_user_and_flags(tmp_path: Path) -> None:
    settings = _configured_settings(tmp_path)
    settings.toss_iap_purchase_enabled = True
    settings.toss_iap_purchase_rollout_percent = 100
    assert toss_iap_purchase_available(settings, UserProvider.toss, "toss-user") is True
    assert toss_iap_purchase_available(settings, UserProvider.google, "google-user") is False
    settings.toss_iap_purchase_enabled = False
    assert toss_iap_purchase_available(settings, UserProvider.toss, "toss-user") is False


def test_purchase_rollout_is_stable_and_zero_is_closed(tmp_path: Path) -> None:
    settings = _configured_settings(tmp_path)
    settings.toss_iap_purchase_enabled = True
    settings.toss_iap_purchase_rollout_percent = 50
    first = toss_iap_purchase_available(settings, UserProvider.toss, "stable-user")
    assert toss_iap_purchase_available(settings, UserProvider.toss, "stable-user") is first
    settings.toss_iap_purchase_rollout_percent = 0
    assert toss_iap_purchase_available(settings, UserProvider.toss, "stable-user") is False


def test_sandbox_configuration_requires_hash_allowlist_and_configured_product(tmp_path: Path) -> None:
    settings = _configured_settings(tmp_path)
    settings.toss_iap_sandbox_enabled = True
    settings.toss_iap_sandbox_product_sku = "sku-500"
    with pytest.raises(ValueError, match="SANDBOX_SUBJECT_HASHES"):
        validate_toss_iap_configuration(settings)
    settings.toss_iap_sandbox_subject_hashes = "a" * 64
    validate_toss_iap_configuration(settings)
    settings.toss_iap_sandbox_product_sku = "unknown"
    with pytest.raises(ValueError, match="SANDBOX_PRODUCT_SKU"):
        validate_toss_iap_configuration(settings)


def test_sandbox_configuration_rejects_malformed_subject_hash(tmp_path: Path) -> None:
    settings = _configured_settings(tmp_path)
    settings.toss_iap_sandbox_enabled = True
    settings.toss_iap_sandbox_product_sku = "sku-500"
    settings.toss_iap_sandbox_subject_hashes = "A" * 64
    with pytest.raises(ValueError, match="lowercase SHA-256"):
        validate_toss_iap_configuration(settings)


def _configured_settings(tmp_path: Path) -> Settings:
    certificate = tmp_path / "certificate.pem"
    private_key = tmp_path / "private-key.pem"
    certificate.write_text("certificate")
    private_key.write_text("private-key")
    return Settings(_env_file=None, toss_iap_enabled=True, toss_mtls_cert_path=str(certificate), toss_mtls_key_path=str(private_key), toss_iap_credit_5000_sku="sku-500", toss_iap_credit_10000_sku="sku-1000", toss_iap_credit_30000_sku="sku-3000", toss_iap_credit_50000_sku="sku-5000", toss_iap_credit_100000_sku="sku-10000", toss_iap_subject_hmac_key="stable-purchase-secret-32-bytes!!")
