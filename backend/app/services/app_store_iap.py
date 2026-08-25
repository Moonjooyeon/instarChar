from __future__ import annotations

import asyncio
from dataclasses import dataclass, replace
from hashlib import sha256
from hmac import compare_digest, new as new_hmac
from pathlib import Path
from uuid import UUID

from appstoreserverlibrary.models.Environment import Environment
from appstoreserverlibrary.signed_data_verifier import SignedDataVerifier, VerificationException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.credit_products import app_store_iap_purchase_available, credit_product_by_app_store_id
from app.core.errors import BadRequestError, ForbiddenError, ServiceUnavailableError
from app.models import User
from app.repositories.app_store_accounts import AppStoreAccountsRepository
from app.repositories.credit_purchases import CreditPurchaseRepository, CreditPurchaseResult


APP_STORE_PURCHASE_PROVIDER = "app_store"


@dataclass(frozen=True)
class AppStoreTransaction:
    transaction_id: str
    product_id: str
    account_token: str
    status: str
    environment: str
    currency: str
    storefront: str
    price_milliunits: int


@dataclass(frozen=True)
class AppStoreNotification:
    notification_uuid: str
    notification_type: str
    signed_transaction: str


@dataclass(frozen=True)
class AppStoreOrder:
    order_id: str
    sku: str
    status: str
    reason: str
    provider: str = APP_STORE_PURCHASE_PROVIDER


class AppStoreVerifier:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.verifiers = self._verifiers()

    async def transaction(self, signed_transaction: str) -> AppStoreTransaction:
        decoded = await self._verify_transaction(signed_transaction)
        return self._transaction(decoded)

    async def notification(self, signed_payload: str) -> AppStoreNotification:
        decoded = await self._verify_notification(signed_payload)
        data = decoded.data
        signed_transaction = data.signedTransactionInfo if data else None
        if not decoded.notificationUUID or not signed_transaction:
            raise BadRequestError("App Store notification is missing transaction information")
        notification_type = decoded.rawNotificationType or getattr(decoded.notificationType, "value", "")
        return AppStoreNotification(decoded.notificationUUID, notification_type, signed_transaction)

    async def _verify_transaction(self, signed_transaction: str) -> object:
        return await self._verify("verify_and_decode_signed_transaction", signed_transaction)

    async def _verify_notification(self, signed_payload: str) -> object:
        return await self._verify("verify_and_decode_notification", signed_payload)

    async def _verify(self, method: str, signed_value: str) -> object:
        for verifier in self.verifiers:
            try:
                return await asyncio.to_thread(getattr(verifier, method), signed_value)
            except VerificationException:
                continue
        raise BadRequestError("App Store signed data verification failed")

    def _verifiers(self) -> tuple[SignedDataVerifier, SignedDataVerifier]:
        roots = [path.read_bytes() for path in self._root_paths()]
        sandbox = SignedDataVerifier(roots, self.settings.app_store_iap_online_checks_enabled, Environment.SANDBOX, self.settings.app_store_iap_bundle_id)
        production = SignedDataVerifier(roots, self.settings.app_store_iap_online_checks_enabled, Environment.PRODUCTION, self.settings.app_store_iap_bundle_id, self.settings.app_store_iap_app_apple_id)
        return sandbox, production

    def _root_paths(self) -> list[Path]:
        return [Path(value.strip()) for value in self.settings.app_store_iap_root_certificate_paths.split(",") if value.strip()]

    def _transaction(self, decoded: object) -> AppStoreTransaction:
        transaction_id = getattr(decoded, "transactionId", None)
        product_id = getattr(decoded, "productId", None)
        account_token = getattr(decoded, "appAccountToken", None)
        if not transaction_id or not product_id or not account_token:
            raise BadRequestError("App Store transaction is missing required fields")
        if getattr(getattr(decoded, "type", None), "value", "") != "Consumable":
            raise BadRequestError("App Store transaction is not consumable")
        status = "REFUNDED" if getattr(decoded, "revocationDate", None) else "PAYMENT_COMPLETED"
        environment = getattr(getattr(decoded, "environment", None), "value", "")
        return AppStoreTransaction(transaction_id, product_id, account_token, status, environment, getattr(decoded, "currency", "") or "", getattr(decoded, "storefront", "") or "", int(getattr(decoded, "price", 0) or 0))


class AppStoreCreditPurchaseService:
    def __init__(self, settings: Settings, purchases: CreditPurchaseRepository, accounts: AppStoreAccountsRepository, verifier: AppStoreVerifier | None = None) -> None:
        self.settings = settings
        self.purchases = purchases
        self.accounts = accounts
        self.verifier = verifier

    async def context(self, user: User) -> UUID | None:
        if not app_store_iap_purchase_available(self.settings, str(user.id)):
            return None
        return await self.accounts.token(user.id)

    async def grant(self, user: User, signed_transaction: str) -> CreditPurchaseResult:
        self._ensure_available(user)
        transaction = await self._verifier().transaction(signed_transaction)
        return await self.grant_transaction(user, transaction)

    async def grant_transaction(self, user: User, transaction: AppStoreTransaction) -> CreditPurchaseResult:
        expected = await self.accounts.token(user.id)
        self._validate_account(expected, transaction.account_token)
        product = credit_product_by_app_store_id(self.settings, transaction.product_id)
        if not product:
            raise BadRequestError("App Store product is not configured")
        order = AppStoreOrder(transaction.transaction_id, transaction.product_id, transaction.status, transaction.environment)
        result = await self.purchases.apply(user, app_store_subject_hash(self.settings, user.id), order, replace(product, price_krw=product.supply_price_krw))
        await self.purchases.record_provider_payment(order.provider, order.order_id, transaction.currency, transaction.storefront, transaction.price_milliunits)
        return result

    def _ensure_available(self, user: User) -> None:
        if not self.settings.app_store_iap_enabled:
            raise ServiceUnavailableError("App Store purchases are not available")
        if not app_store_iap_purchase_available(self.settings, str(user.id)):
            raise ForbiddenError("App Store purchases are not available for this account")

    def _validate_account(self, expected: UUID, actual: str) -> None:
        if not compare_digest(str(expected), actual):
            raise ForbiddenError("App Store purchase does not belong to this user")

    def _verifier(self) -> AppStoreVerifier:
        if self.verifier is None:
            self.verifier = AppStoreVerifier(self.settings)
        return self.verifier


def app_store_subject_hash(settings: Settings, user_id: UUID) -> str:
    message = f"app-store:{user_id}".encode()
    return new_hmac(settings.app_store_iap_subject_hmac_key.encode(), message, sha256).hexdigest()
