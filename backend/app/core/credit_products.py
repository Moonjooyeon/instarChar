from __future__ import annotations

from dataclasses import dataclass

from app.core.config import Settings


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
    CreditProduct("credit-5000", 5000, 500, 0, "가볍게 이어가기"),
    CreditProduct("credit-10000", 10000, 1000, 0, "꾸준히 이어가기"),
    CreditProduct("credit-30000", 30000, 3000, 150, "가장 많이 선택해요"),
    CreditProduct("credit-50000", 50000, 5000, 500, "오래 즐기기"),
    CreditProduct("credit-100000", 100000, 10000, 1500, "깊게 이어가기"),
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
