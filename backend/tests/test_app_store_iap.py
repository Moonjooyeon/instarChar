import asyncio
from pathlib import Path
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest

from app.core.config import Settings
from app.core.credit_products import app_store_iap_purchase_available, credit_product_by_app_store_id, validate_app_store_iap_configuration
from app.core.errors import ForbiddenError
from app.repositories.credit_purchases import CreditPurchaseResult
from app.services.app_store_iap import APP_STORE_PURCHASE_PROVIDER, AppStoreCreditPurchaseService, AppStoreTransaction


class StubAccounts:
    def __init__(self, token: UUID) -> None:
        self.token_value = token

    async def token(self, user_id: UUID) -> UUID:
        return self.token_value


class StubPurchases:
    def __init__(self) -> None:
        self.calls: list[tuple[object, str, object, object]] = []
        self.payment: tuple[str, str, str, str, int] | None = None

    async def apply(self, user: object, subject_hash: str, order: object, product: object) -> CreditPurchaseResult:
        self.calls.append((user, subject_hash, order, product))
        return CreditPurchaseResult("transaction-1", "granted", 550, 550, 0, 0)

    async def record_provider_payment(self, provider: str, order_id: str, currency: str, storefront: str, price_milliunits: int) -> None:
        self.payment = (provider, order_id, currency, storefront, price_milliunits)


class StubVerifier:
    def __init__(self, transaction: AppStoreTransaction) -> None:
        self.value = transaction

    async def transaction(self, signed_transaction: str) -> AppStoreTransaction:
        assert signed_transaction == "signed-transaction"
        return self.value


def test_app_store_configuration_requires_enabled_integration() -> None:
    settings = Settings(_env_file=None, app_store_iap_purchase_enabled=True)
    with pytest.raises(ValueError, match="APP_STORE_IAP_ENABLED"):
        validate_app_store_iap_configuration(settings)


def test_app_store_configuration_accepts_root_certificates(tmp_path: Path) -> None:
    certificate = tmp_path / "apple-root.pem"
    certificate.write_text("certificate")
    validate_app_store_iap_configuration(configured_settings(str(certificate)))


def test_app_store_rollout_is_stable_and_separate_from_google_play() -> None:
    settings = configured_settings("/tmp/apple-root.pem")
    settings.app_store_iap_purchase_rollout_percent = 50
    first = app_store_iap_purchase_available(settings, "user-1")
    assert app_store_iap_purchase_available(settings, "user-1") is first
    settings.app_store_iap_purchase_enabled = False
    assert app_store_iap_purchase_available(settings, "user-1") is False


def test_app_store_service_verifies_owner_grants_and_records_payment() -> None:
    token = uuid4()
    transaction = AppStoreTransaction("transaction-1", "ALIVE_CREDITS_500", str(token), "PAYMENT_COMPLETED", "Sandbox", "KRW", "KOR", 4900000)
    purchases = StubPurchases()
    user = SimpleNamespace(id=uuid4())
    service = AppStoreCreditPurchaseService(configured_settings("/tmp/apple-root.pem"), purchases, StubAccounts(token), StubVerifier(transaction))  # type: ignore[arg-type]
    result = run(service.grant(user, "signed-transaction"))
    order = purchases.calls[0][2]
    product = purchases.calls[0][3]
    assert (result.status, order.provider, order.sku) == ("granted", APP_STORE_PURCHASE_PROVIDER, "ALIVE_CREDITS_500")
    assert product.price_krw == 4900
    assert purchases.payment == (APP_STORE_PURCHASE_PROVIDER, "transaction-1", "KRW", "KOR", 4900000)


def test_app_store_service_rejects_transaction_for_another_account() -> None:
    transaction = AppStoreTransaction("transaction-1", "ALIVE_CREDITS_500", str(uuid4()), "PAYMENT_COMPLETED", "Sandbox", "KRW", "KOR", 4900000)
    user = SimpleNamespace(id=uuid4())
    service = AppStoreCreditPurchaseService(configured_settings("/tmp/apple-root.pem"), StubPurchases(), StubAccounts(uuid4()), StubVerifier(transaction))  # type: ignore[arg-type]
    with pytest.raises(ForbiddenError, match="does not belong"):
        run(service.grant(user, "signed-transaction"))


def test_app_store_product_mapping_uses_console_product_ids() -> None:
    settings = configured_settings("/tmp/apple-root.pem")
    assert credit_product_by_app_store_id(settings, "ALIVE_CREDITS_11500").offer_id == "credit-100000"
    assert credit_product_by_app_store_id(settings, "unconfigured") is None


def configured_settings(certificate_path: str) -> Settings:
    return Settings(_env_file=None, app_store_iap_enabled=True, app_store_iap_purchase_enabled=True, app_store_iap_purchase_rollout_percent=100, app_store_iap_app_apple_id=123456789, app_store_iap_root_certificate_paths=certificate_path, app_store_iap_subject_hmac_key="stable-app-store-secret-at-least-32")


def run(coroutine: object) -> object:
    return asyncio.run(coroutine)  # type: ignore[arg-type]
