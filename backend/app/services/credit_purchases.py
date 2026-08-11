from __future__ import annotations

from hashlib import sha256
from hmac import compare_digest, new as new_hmac
from typing import Literal
from uuid import UUID

from app.core.config import Settings
from app.core.credit_products import credit_product_by_sku
from app.core.errors import BadRequestError, ForbiddenError, ServiceUnavailableError
from app.models import User, UserProvider
from app.repositories.credit_purchases import CreditPurchaseRepository, CreditPurchaseResult
from app.services.toss_api import TossApiClient
from app.services.toss_iap import TossIapOrder, TossIapService


TOSS_IAP_SANDBOX_FIXTURE_SKU = "sku_106"
TossIapEnvironment = Literal["toss", "sandbox"]


def toss_iap_subject_hash(settings: Settings, subject: str, environment: TossIapEnvironment = "toss") -> str:
    if len(settings.toss_iap_subject_hmac_key.encode()) < 32:
        raise ServiceUnavailableError("Purchase identity protection is not configured")
    namespace = "sandbox:toss" if environment == "sandbox" else "toss"
    message = f"{namespace}:{subject}".encode()
    return new_hmac(settings.toss_iap_subject_hmac_key.encode(), message, sha256).hexdigest()


class CreditPurchaseService:
    def __init__(self, settings: Settings, purchases: CreditPurchaseRepository, iap: TossIapService | None = None) -> None:
        self.settings = settings
        self.purchases = purchases
        self.iap = iap or TossIapService(TossApiClient(settings))

    async def grant(self, user: User, order_id: str, sku: str = "", environment: TossIapEnvironment = "toss") -> CreditPurchaseResult:
        self._ensure_available(user)
        subject_hash = self._subject_hash(user.provider_subject, environment)
        order = await self._verified_order(order_id, sku, environment, user.provider_subject, subject_hash)
        product = credit_product_by_sku(self.settings, order.sku)
        if not product:
            raise BadRequestError("Purchase product is not configured")
        return await self.purchases.apply(user, subject_hash, order, product)

    async def reconcile(self, purchase_id: UUID, order_id: str) -> None:
        if not self.settings.toss_iap_enabled:
            return
        order = await self.iap.get_order(order_id)
        await self.purchases.reconcile(purchase_id, order)

    def _ensure_available(self, user: User) -> None:
        if not self.settings.toss_iap_enabled:
            raise ServiceUnavailableError("Purchases are not available")
        if user.provider != UserProvider.toss or not user.provider_subject:
            raise ForbiddenError("Apps in Toss login is required")

    async def _verified_order(self, order_id: str, sku: str, environment: TossIapEnvironment, subject: str, subject_hash: str) -> TossIapOrder:
        if environment == "sandbox":
            return self._sandbox_order(order_id, sku, subject_hash)
        order = await self.iap.get_order(order_id, subject)
        if sku and order.sku != sku:
            raise BadRequestError("Purchase product does not match the verified order")
        return order

    def _sandbox_order(self, order_id: str, sku: str, subject_hash: str) -> TossIapOrder:
        self._ensure_sandbox_subject(subject_hash)
        normalized_order_id = self._sandbox_order_uuid(order_id)
        product_sku = self._sandbox_product_sku(sku)
        internal_id = self._sandbox_order_id(subject_hash, product_sku, normalized_order_id)
        return TossIapOrder(internal_id, product_sku, "PAYMENT_COMPLETED", "", "Apps in Toss sandbox fixture", "apps_in_toss_sandbox")

    def _sandbox_order_uuid(self, order_id: str) -> str:
        try:
            normalized = str(UUID(order_id))
        except ValueError as exc:
            raise BadRequestError("Sandbox purchase order is not recognized") from exc
        if len(order_id) != 36 or order_id.lower() != normalized:
            raise BadRequestError("Sandbox purchase order is not recognized")
        return normalized

    def _ensure_sandbox_subject(self, subject_hash: str) -> None:
        if not self.settings.toss_iap_sandbox_enabled:
            raise ServiceUnavailableError("Sandbox purchases are not available")
        allowed = [value.strip() for value in self.settings.toss_iap_sandbox_subject_hashes.split(",") if value.strip()]
        if not any(compare_digest(subject_hash, value) for value in allowed):
            raise ForbiddenError("Sandbox purchase tester is not allowed")

    def _sandbox_product_sku(self, requested_sku: str) -> str:
        configured = self.settings.toss_iap_sandbox_product_sku
        if requested_sku not in (configured, TOSS_IAP_SANDBOX_FIXTURE_SKU):
            raise BadRequestError("Sandbox purchase product is not configured")
        return configured

    def _sandbox_order_id(self, subject_hash: str, sku: str, order_id: str) -> str:
        message = f"sandbox-order:{subject_hash}:{sku}:{order_id}".encode()
        digest = new_hmac(self.settings.toss_iap_subject_hmac_key.encode(), message, sha256).hexdigest()
        return f"sandbox:{digest}"

    def _subject_hash(self, subject: str, environment: TossIapEnvironment = "toss") -> str:
        return toss_iap_subject_hash(self.settings, subject, environment)
