from __future__ import annotations

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
    CreditProduct("credit-5000", 4950, 500, 0, "가볍게 이어가기"),
    CreditProduct("credit-10000", 9900, 1000, 0, "꾸준히 이어가기"),
    CreditProduct("credit-30000", 29700, 3000, 150, "가장 많이 선택해요"),
    CreditProduct("credit-50000", 49500, 5000, 500, "오래 즐기기"),
    CreditProduct("credit-100000", 99000, 10000, 1500, "깊게 이어가기"),
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


def validate_toss_iap_configuration(settings: Settings) -> None:
    requested = settings.toss_iap_enabled or settings.toss_iap_purchase_enabled or settings.toss_iap_reconciliation_enabled or settings.toss_iap_audit_alerts_enabled
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
