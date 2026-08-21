from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
from hmac import compare_digest, new as new_hmac
from typing import Literal
from uuid import UUID

from app.core.config import Settings
from app.core.credit_products import credit_product_by_google_play_id, google_play_iap_purchase_available
from app.core.errors import BadRequestError, ConflictError, ForbiddenError, ServiceUnavailableError
from app.models import CreditPurchase, User
from app.repositories.credit_purchases import CreditPurchaseRepository, CreditPurchaseResult
from app.repositories.google_play_accounts import GooglePlayAccountsRepository
from app.services.google_play_api import GooglePlayApiClient, GooglePlayPurchase


GOOGLE_PLAY_PURCHASE_PROVIDER = "google_play"
GooglePlayOrderStatus = Literal["PAYMENT_COMPLETED", "ORDER_IN_PROGRESS", "FAILED", "REFUNDED"]


@dataclass(frozen=True)
class GooglePlayOrder:
    order_id: str
    sku: str
    status: GooglePlayOrderStatus
    reason: str
    provider: str = GOOGLE_PLAY_PURCHASE_PROVIDER


def google_play_account_id(settings: Settings, user_id: UUID) -> str:
    _ensure_google_play_hmac_key(settings)
    message = f"google-play:{user_id}".encode()
    return new_hmac(settings.google_play_iap_subject_hmac_key.encode(), message, sha256).hexdigest()


class GooglePlayCreditPurchaseService:
    def __init__(self, settings: Settings, purchases: CreditPurchaseRepository, api: GooglePlayApiClient | None = None) -> None:
        self.settings = settings
        self.purchases = purchases
        self.api = api or GooglePlayApiClient(settings)

    async def grant(self, user: User, purchase_token: str) -> CreditPurchaseResult:
        self._ensure_available(user)
        verified = await self.api.get_purchase(purchase_token)
        self._validate_account(user.id, verified)
        product = credit_product_by_google_play_id(self.settings, verified.product_id)
        if not product:
            raise BadRequestError("Google Play product is not configured")
        result = await self.purchases.apply(user, self._subject_hash(user.id), self._order(verified), product)
        await self._consume_granted_purchase(user.id, verified, result)
        return result

    def account_id(self, user: User) -> str:
        self._ensure_available(user)
        return google_play_account_id(self.settings, user.id)

    def _ensure_available(self, user: User) -> None:
        if not self.settings.google_play_iap_enabled:
            raise ServiceUnavailableError("Google Play purchases are not available")
        if not google_play_iap_purchase_available(self.settings, str(user.id)):
            raise ForbiddenError("Google Play purchases are not available for this account")

    def _validate_account(self, user_id: UUID, purchase: GooglePlayPurchase) -> None:
        expected = google_play_account_id(self.settings, user_id)
        if not compare_digest(expected, purchase.obfuscated_account_id):
            raise ForbiddenError("Google Play purchase does not belong to this user")

    def _subject_hash(self, user_id: UUID) -> str:
        return google_play_account_id(self.settings, user_id)

    def _order(self, purchase: GooglePlayPurchase) -> GooglePlayOrder:
        statuses: dict[str, GooglePlayOrderStatus] = {"PURCHASED": "PAYMENT_COMPLETED", "PENDING": "ORDER_IN_PROGRESS", "CANCELLED": "FAILED"}
        return GooglePlayOrder(purchase.purchase_token, purchase.product_id, statuses[purchase.state], purchase.state)

    async def _consume_granted_purchase(self, user_id: UUID, purchase: GooglePlayPurchase, result: CreditPurchaseResult) -> None:
        await consume_granted_google_play_purchase(self.purchases, self.api, user_id, purchase, result)


class GooglePlayRtdnPurchaseService:
    def __init__(self, settings: Settings, purchases: CreditPurchaseRepository, accounts: GooglePlayAccountsRepository, api: GooglePlayApiClient | None = None) -> None:
        self.settings = settings
        self.purchases = purchases
        self.accounts = accounts
        self.api = api or GooglePlayApiClient(settings)

    async def process_purchase(self, purchase_token: str) -> str:
        self._ensure_enabled()
        verified = await self.api.get_purchase(purchase_token)
        user = await self.accounts.user(verified.obfuscated_account_id)
        if not user:
            return "ignored"
        self._validate_account(user.id, verified)
        product = credit_product_by_google_play_id(self.settings, verified.product_id)
        if not product:
            return "ignored"
        if verified.state != "PURCHASED":
            return await self._reconcile(user, verified)
        result = await self.purchases.apply(user, google_play_account_id(self.settings, user.id), GooglePlayOrder(verified.purchase_token, verified.product_id, "PAYMENT_COMPLETED", verified.state), product)
        await consume_granted_google_play_purchase(self.purchases, self.api, user.id, verified, result)
        return result.status

    async def process_refund(self, purchase_token: str) -> str:
        self._ensure_enabled()
        purchase = await self.purchases.provider_order(GOOGLE_PLAY_PURCHASE_PROVIDER, purchase_token)
        if not purchase:
            return "ignored"
        await self.purchases.reconcile(purchase.id, GooglePlayOrder(purchase_token, purchase.sku, "REFUNDED", "VOIDED"))
        return "refunded"

    async def _reconcile(self, user: User, purchase: GooglePlayPurchase) -> str:
        saved = await self.purchases.provider_purchase(user.id, GOOGLE_PLAY_PURCHASE_PROVIDER, purchase.purchase_token)
        if not saved:
            return "ignored"
        statuses: dict[str, GooglePlayOrderStatus] = {"PENDING": "ORDER_IN_PROGRESS", "CANCELLED": "FAILED", "PURCHASED": "PAYMENT_COMPLETED"}
        await self.purchases.reconcile(saved.id, GooglePlayOrder(purchase.purchase_token, purchase.product_id, statuses[purchase.state], purchase.state))
        return "reconciled"

    def _ensure_enabled(self) -> None:
        if not self.settings.google_play_iap_enabled or not self.settings.google_play_rtdn_enabled:
            raise ServiceUnavailableError("Google Play RTDN is not available")

    def _validate_account(self, user_id: UUID, purchase: GooglePlayPurchase) -> None:
        expected = google_play_account_id(self.settings, user_id)
        if not compare_digest(expected, purchase.obfuscated_account_id):
            raise ForbiddenError("Google Play purchase does not belong to this user")


async def consume_granted_google_play_purchase(purchases: CreditPurchaseRepository, api: GooglePlayApiClient, user_id: UUID, purchase: GooglePlayPurchase, result: CreditPurchaseResult) -> None:
    if result.status != "granted":
        return
    saved = await purchases.provider_purchase(user_id, GOOGLE_PLAY_PURCHASE_PROVIDER, purchase.purchase_token)
    if not saved or saved.provider_consumed_at:
        return
    await api.consume(purchase.product_id, purchase.purchase_token)
    await purchases.mark_provider_consumed(GOOGLE_PLAY_PURCHASE_PROVIDER, purchase.purchase_token)


def _ensure_google_play_hmac_key(settings: Settings) -> None:
    if len(settings.google_play_iap_subject_hmac_key.encode()) < 32:
        raise ServiceUnavailableError("Google Play purchase identity protection is not configured")
