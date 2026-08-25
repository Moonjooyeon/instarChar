from __future__ import annotations

import re
from dataclasses import dataclass
from hashlib import sha256
from hmac import new as new_hmac
from pathlib import Path

from app.core.config import Settings
from app.models import UserProvider


FIRST_PURCHASE_BONUS_PERCENT = 10


@dataclass(frozen=True)
class CreditProduct:
    offer_id: str
    supply_price_krw: int
    price_krw: int
    base_credits: int
    product_bonus_credits: int
    label: str

    @property
    def total_credits(self) -> int:
        return self.base_credits + self.product_bonus_credits

    @property
    def first_purchase_bonus_credits(self) -> int:
        return self.total_credits * FIRST_PURCHASE_BONUS_PERCENT // 100


CREDIT_PRODUCTS = (
    CreditProduct("credit-5000", 4900, 5390, 500, 0, "가볍게 이어가기"),
    CreditProduct("credit-10000", 9900, 10890, 1000, 0, "꾸준히 이어가기"),
    CreditProduct("credit-30000", 29500, 32450, 3000, 150, "가장 많이 선택해요"),
    CreditProduct("credit-50000", 49500, 54450, 5000, 500, "오래 즐기기"),
    CreditProduct("credit-100000", 99000, 108900, 10000, 1500, "깊게 이어가기"),
)


def credit_product_skus(settings: Settings) -> dict[str, str]:
    return {
        "credit-5000": settings.toss_iap_credit_5000_sku,
        "credit-10000": settings.toss_iap_credit_10000_sku,
        "credit-30000": settings.toss_iap_credit_30000_sku,
        "credit-50000": settings.toss_iap_credit_50000_sku,
        "credit-100000": settings.toss_iap_credit_100000_sku,
    }


def credit_product_by_sku(settings: Settings, sku: str) -> CreditProduct | None:
    configured = credit_product_skus(settings)
    return next((product for product in CREDIT_PRODUCTS if configured[product.offer_id] == sku and sku), None)


def google_play_product_ids(settings: Settings) -> dict[str, str]:
    return {
        "credit-5000": settings.google_play_iap_credit_5000_product_id,
        "credit-10000": settings.google_play_iap_credit_10000_product_id,
        "credit-30000": settings.google_play_iap_credit_30000_product_id,
        "credit-50000": settings.google_play_iap_credit_50000_product_id,
        "credit-100000": settings.google_play_iap_credit_100000_product_id,
    }


def credit_product_by_google_play_id(settings: Settings, product_id: str) -> CreditProduct | None:
    configured = google_play_product_ids(settings)
    return next((product for product in CREDIT_PRODUCTS if configured[product.offer_id] == product_id and product_id), None)


def app_store_product_ids(settings: Settings) -> dict[str, str]:
    return {
        "credit-5000": settings.app_store_iap_credit_5000_product_id,
        "credit-10000": settings.app_store_iap_credit_10000_product_id,
        "credit-30000": settings.app_store_iap_credit_30000_product_id,
        "credit-50000": settings.app_store_iap_credit_50000_product_id,
        "credit-100000": settings.app_store_iap_credit_100000_product_id,
    }


def credit_product_by_app_store_id(settings: Settings, product_id: str) -> CreditProduct | None:
    configured = app_store_product_ids(settings)
    return next((product for product in CREDIT_PRODUCTS if configured[product.offer_id] == product_id and product_id), None)


def validate_toss_iap_configuration(settings: Settings) -> None:
    requested = settings.toss_iap_enabled or settings.toss_iap_purchase_enabled or settings.toss_iap_reconciliation_enabled or settings.toss_iap_audit_alerts_enabled or settings.toss_iap_sandbox_enabled
    if not requested:
        return
    if not settings.toss_iap_enabled:
        raise ValueError("TOSS_IAP_ENABLED must be true before enabling purchase or reconciliation")
    if settings.toss_iap_purchase_enabled and not settings.toss_iap_reconciliation_enabled:
        raise ValueError("TOSS_IAP_RECONCILIATION_ENABLED must be true before enabling purchases")
    if settings.toss_iap_purchase_enabled and not settings.toss_iap_audit_alerts_enabled:
        raise ValueError("TOSS_IAP_AUDIT_ALERTS_ENABLED must be true before enabling purchases")
    if settings.toss_iap_audit_alerts_enabled and not settings.toss_iap_reconciliation_enabled:
        raise ValueError("TOSS_IAP_RECONCILIATION_ENABLED must be true before enabling audit alerts")
    _validate_iap_credentials(settings)
    _validate_iap_skus(settings)
    _validate_iap_rollout(settings)
    _validate_iap_sandbox(settings)


def validate_google_play_iap_configuration(settings: Settings) -> None:
    requested = settings.google_play_iap_enabled or settings.google_play_iap_purchase_enabled or settings.google_play_rtdn_enabled
    if not requested:
        return
    if not settings.google_play_iap_enabled:
        raise ValueError("GOOGLE_PLAY_IAP_ENABLED must be true before enabling purchases")
    _validate_google_play_rollout(settings)
    _validate_google_play_credentials(settings)
    _validate_google_play_product_ids(settings)
    _validate_google_play_rtdn(settings)


def validate_app_store_iap_configuration(settings: Settings) -> None:
    requested = settings.app_store_iap_enabled or settings.app_store_iap_purchase_enabled
    if not requested:
        return
    if not settings.app_store_iap_enabled:
        raise ValueError("APP_STORE_IAP_ENABLED must be true before enabling purchases")
    _validate_app_store_rollout(settings)
    _validate_app_store_credentials(settings)
    _validate_app_store_product_ids(settings)


def toss_iap_purchase_available(settings: Settings, provider: UserProvider, subject: str) -> bool:
    if not settings.toss_iap_enabled or not settings.toss_iap_purchase_enabled:
        return False
    if provider != UserProvider.toss or not subject:
        return False
    percent = settings.toss_iap_purchase_rollout_percent
    if percent <= 0:
        return False
    if percent >= 100:
        return True
    message = f"purchase-rollout:toss:{subject}".encode()
    digest = new_hmac(settings.toss_iap_subject_hmac_key.encode(), message, sha256).digest()
    return int.from_bytes(digest[:8], "big") % 100 < percent


def google_play_iap_purchase_available(settings: Settings, subject: str) -> bool:
    if not settings.google_play_iap_enabled or not settings.google_play_iap_purchase_enabled or not subject:
        return False
    percent = settings.google_play_iap_purchase_rollout_percent
    if percent <= 0:
        return False
    if percent >= 100:
        return True
    message = f"purchase-rollout:google-play:{subject}".encode()
    digest = new_hmac(settings.google_play_iap_subject_hmac_key.encode(), message, sha256).digest()
    return int.from_bytes(digest[:8], "big") % 100 < percent


def app_store_iap_purchase_available(settings: Settings, subject: str) -> bool:
    if not settings.app_store_iap_enabled or not settings.app_store_iap_purchase_enabled or not subject:
        return False
    percent = settings.app_store_iap_purchase_rollout_percent
    if percent <= 0:
        return False
    if percent >= 100:
        return True
    message = f"purchase-rollout:app-store:{subject}".encode()
    digest = new_hmac(settings.app_store_iap_subject_hmac_key.encode(), message, sha256).digest()
    return int.from_bytes(digest[:8], "big") % 100 < percent


def _validate_iap_credentials(settings: Settings) -> None:
    key = settings.toss_iap_subject_hmac_key
    if len(key.encode()) < 32 or not key.strip():
        raise ValueError("TOSS_IAP_SUBJECT_HMAC_KEY must contain at least 32 bytes")
    if key == settings.auth_secret_key:
        raise ValueError("TOSS_IAP_SUBJECT_HMAC_KEY must be separate from AUTH_SECRET_KEY")
    files = ((settings.toss_mtls_cert_path, "TOSS_MTLS_CERT_PATH"), (settings.toss_mtls_key_path, "TOSS_MTLS_KEY_PATH"))
    missing = next((name for path, name in files if not path or not Path(path).is_file()), "")
    if missing:
        raise ValueError(f"{missing} must point to an existing file when Toss IAP is enabled")


def _validate_iap_skus(settings: Settings) -> None:
    skus = list(credit_product_skus(settings).values())
    if any(not sku.strip() or sku != sku.strip() for sku in skus):
        raise ValueError("All Toss IAP credit SKUs must be present without surrounding whitespace")
    if len(set(skus)) != len(skus):
        raise ValueError("Toss IAP credit SKUs must be unique")


def _validate_iap_rollout(settings: Settings) -> None:
    percent = settings.toss_iap_purchase_rollout_percent
    if percent < 0 or percent > 100:
        raise ValueError("TOSS_IAP_PURCHASE_ROLLOUT_PERCENT must be between 0 and 100")


def _validate_iap_sandbox(settings: Settings) -> None:
    if not settings.toss_iap_sandbox_enabled:
        return
    hashes = [value.strip() for value in settings.toss_iap_sandbox_subject_hashes.split(",") if value.strip()]
    if not hashes or any(not re.fullmatch(r"[0-9a-f]{64}", value) for value in hashes):
        raise ValueError("TOSS_IAP_SANDBOX_SUBJECT_HASHES must contain comma-separated lowercase SHA-256 HMAC hashes")
    configured = set(credit_product_skus(settings).values())
    if settings.toss_iap_sandbox_product_sku not in configured:
        raise ValueError("TOSS_IAP_SANDBOX_PRODUCT_SKU must match a configured Toss IAP credit SKU")


def _validate_google_play_rollout(settings: Settings) -> None:
    percent = settings.google_play_iap_purchase_rollout_percent
    if percent < 0 or percent > 100:
        raise ValueError("GOOGLE_PLAY_IAP_PURCHASE_ROLLOUT_PERCENT must be between 0 and 100")


def _validate_google_play_credentials(settings: Settings) -> None:
    key = settings.google_play_iap_subject_hmac_key
    if len(key.encode()) < 32 or not key.strip():
        raise ValueError("GOOGLE_PLAY_IAP_SUBJECT_HMAC_KEY must contain at least 32 bytes")
    if key == settings.auth_secret_key:
        raise ValueError("GOOGLE_PLAY_IAP_SUBJECT_HMAC_KEY must be separate from AUTH_SECRET_KEY")
    if not settings.google_play_iap_package_name.strip():
        raise ValueError("GOOGLE_PLAY_IAP_PACKAGE_NAME must be present")
    if not Path(settings.google_play_iap_service_account_json_path).is_file():
        raise ValueError("GOOGLE_PLAY_IAP_SERVICE_ACCOUNT_JSON_PATH must point to an existing file")


def _validate_google_play_product_ids(settings: Settings) -> None:
    product_ids = list(google_play_product_ids(settings).values())
    if any(not product_id.strip() or product_id != product_id.strip() for product_id in product_ids):
        raise ValueError("All Google Play credit product IDs must be present without surrounding whitespace")
    if len(set(product_ids)) != len(product_ids):
        raise ValueError("Google Play credit product IDs must be unique")


def _validate_google_play_rtdn(settings: Settings) -> None:
    if not settings.google_play_rtdn_enabled:
        return
    if not settings.google_play_rtdn_audience.strip():
        raise ValueError("GOOGLE_PLAY_RTDN_AUDIENCE must be present when RTDN is enabled")
    email = settings.google_play_rtdn_push_service_account_email
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.gserviceaccount\.com", email):
        raise ValueError("GOOGLE_PLAY_RTDN_PUSH_SERVICE_ACCOUNT_EMAIL must be a service account email")


def _validate_app_store_rollout(settings: Settings) -> None:
    percent = settings.app_store_iap_purchase_rollout_percent
    if percent < 0 or percent > 100:
        raise ValueError("APP_STORE_IAP_PURCHASE_ROLLOUT_PERCENT must be between 0 and 100")


def _validate_app_store_credentials(settings: Settings) -> None:
    if not settings.app_store_iap_bundle_id.strip():
        raise ValueError("APP_STORE_IAP_BUNDLE_ID must be present")
    if settings.app_store_iap_app_apple_id <= 0:
        raise ValueError("APP_STORE_IAP_APP_APPLE_ID must be present")
    paths = [Path(value.strip()) for value in settings.app_store_iap_root_certificate_paths.split(",") if value.strip()]
    if not paths or any(not path.is_file() for path in paths):
        raise ValueError("APP_STORE_IAP_ROOT_CERTIFICATE_PATHS must contain existing PEM files")
    key = settings.app_store_iap_subject_hmac_key
    if len(key.encode()) < 32 or key == settings.auth_secret_key:
        raise ValueError("APP_STORE_IAP_SUBJECT_HMAC_KEY must be separate and contain at least 32 bytes")


def _validate_app_store_product_ids(settings: Settings) -> None:
    product_ids = list(app_store_product_ids(settings).values())
    if any(not product_id.strip() or product_id != product_id.strip() for product_id in product_ids):
        raise ValueError("All App Store credit product IDs must be present without surrounding whitespace")
    if len(set(product_ids)) != len(product_ids):
        raise ValueError("App Store credit product IDs must be unique")
