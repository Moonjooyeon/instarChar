from __future__ import annotations

from hashlib import sha256
from hmac import new as new_hmac
from uuid import UUID

from app.core.config import Settings
from app.core.credit_products import credit_product_by_sku
from app.core.errors import BadRequestError, ForbiddenError, ServiceUnavailableError
from app.models import User, UserProvider
from app.repositories.credit_purchases import CreditPurchaseRepository, CreditPurchaseResult
from app.services.toss_api import TossApiClient
from app.services.toss_iap import TossIapService


class CreditPurchaseService:
    def __init__(self, settings: Settings, purchases: CreditPurchaseRepository, iap: TossIapService | None = None) -> None:
        self.settings = settings
        self.purchases = purchases
        self.iap = iap or TossIapService(TossApiClient(settings))

    async def grant(self, user: User, order_id: str) -> CreditPurchaseResult:
        self._ensure_available(user)
        order = await self.iap.get_order(order_id, user.provider_subject)
        product = credit_product_by_sku(self.settings, order.sku)
        if not product:
            raise BadRequestError("Purchase product is not configured")
        subject_hash = self._subject_hash(user.provider_subject)
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

    def _subject_hash(self, subject: str) -> str:
        if len(self.settings.toss_iap_subject_hmac_key.encode()) < 32:
            raise ServiceUnavailableError("Purchase identity protection is not configured")
        message = f"toss:{subject}".encode()
        return new_hmac(self.settings.toss_iap_subject_hmac_key.encode(), message, sha256).hexdigest()
