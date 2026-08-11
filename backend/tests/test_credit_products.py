from pathlib import Path

import pytest

from app.core.config import Settings
from app.core.credit_products import validate_toss_iap_configuration


def test_complete_toss_iap_configuration_is_valid(tmp_path: Path) -> None:
    validate_toss_iap_configuration(_configured_settings(tmp_path))


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


def _configured_settings(tmp_path: Path) -> Settings:
    certificate = tmp_path / "certificate.pem"
    private_key = tmp_path / "private-key.pem"
    certificate.write_text("certificate")
    private_key.write_text("private-key")
    return Settings(_env_file=None, toss_iap_enabled=True, toss_mtls_cert_path=str(certificate), toss_mtls_key_path=str(private_key), toss_iap_credit_5000_sku="sku-500", toss_iap_credit_10000_sku="sku-1000", toss_iap_credit_30000_sku="sku-3000", toss_iap_credit_50000_sku="sku-5000", toss_iap_credit_100000_sku="sku-10000", toss_iap_subject_hmac_key="stable-purchase-secret-32-bytes!!")
