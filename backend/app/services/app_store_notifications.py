from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import ServiceUnavailableError
from app.repositories.app_store_accounts import AppStoreAccountsRepository
from app.repositories.app_store_notification_events import AppStoreNotificationEventsRepository
from app.repositories.credit_purchases import CreditPurchaseRepository
from app.services.app_store_iap import APP_STORE_PURCHASE_PROVIDER, AppStoreCreditPurchaseService, AppStoreNotification, AppStoreOrder, AppStoreTransaction, AppStoreVerifier


class AppStoreNotificationService:
    def __init__(self, settings: Settings, session: AsyncSession, verifier: AppStoreVerifier | None = None) -> None:
        self.settings = settings
        self.events = AppStoreNotificationEventsRepository(session)
        self.accounts = AppStoreAccountsRepository(session)
        self.purchases = CreditPurchaseRepository(session)
        self.verifier = verifier or AppStoreVerifier(settings)

    async def process(self, signed_payload: str) -> None:
        self._ensure_enabled()
        notification = await self.verifier.notification(signed_payload)
        transaction = await self.verifier.transaction(notification.signed_transaction)
        event_id = await self.events.claim(notification.notification_uuid, notification.notification_type, transaction.transaction_id)
        if not event_id:
            return
        await self._process_event(event_id, notification, transaction)

    async def _process_event(self, event_id: UUID, notification: AppStoreNotification, transaction: AppStoreTransaction) -> None:
        try:
            status = await self._apply(notification, transaction)
        except Exception as exc:
            await self.events.fail(event_id, type(exc).__name__)
            raise
        await self.events.complete(event_id, status)

    async def _apply(self, notification: AppStoreNotification, transaction: AppStoreTransaction) -> str:
        if notification.notification_type == "ONE_TIME_CHARGE":
            return await self._grant(transaction)
        if notification.notification_type == "REFUND":
            return await self._reconcile(transaction, "REFUNDED")
        if notification.notification_type == "REFUND_REVERSED":
            return await self._reconcile(transaction, "REFUND_REVERSED")
        return "ignored"

    async def _grant(self, transaction: AppStoreTransaction) -> str:
        account_token = transaction.account_token
        try:
            user = await self.accounts.user(UUID(account_token))
        except ValueError:
            return "ignored"
        if not user:
            return "ignored"
        service = AppStoreCreditPurchaseService(self.settings, self.purchases, self.accounts, self.verifier)
        return (await service.grant_transaction(user, transaction)).status

    async def _reconcile(self, transaction: AppStoreTransaction, status: str) -> str:
        order_id = transaction.transaction_id
        purchase = await self.purchases.provider_order(APP_STORE_PURCHASE_PROVIDER, order_id)
        if not purchase:
            return "ignored"
        order = AppStoreOrder(order_id, purchase.sku, status, transaction.environment)
        await self.purchases.reconcile(purchase.id, order)
        return "refunded" if status == "REFUNDED" else "restored"

    def _ensure_enabled(self) -> None:
        if not self.settings.app_store_iap_enabled:
            raise ServiceUnavailableError("App Store notifications are not available")
