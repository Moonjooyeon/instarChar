import asyncio
import base64
import json
from collections.abc import Coroutine
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import TypeVar
from uuid import uuid4

import jwt
import pytest
import httpx
from cryptography.hazmat.primitives.asymmetric import rsa

from app.core.config import Settings
from app.core.credit_products import credit_product_by_google_play_id, google_play_iap_purchase_available, toss_iap_purchase_available, validate_google_play_iap_configuration, validate_toss_iap_configuration
from app.core.errors import BadRequestError, ForbiddenError, ServiceUnavailableError, UnauthorizedError
from app.models import UserProvider
from app.repositories.credit_purchases import CreditPurchaseResult
from app.services.google_play_api import GooglePlayPurchase, _publisher_response, google_play_purchase
from app.services.google_play_purchases import GOOGLE_PLAY_PURCHASE_PROVIDER, GooglePlayCreditPurchaseService, GooglePlayRtdnPurchaseService, google_play_account_id
from app.services.google_play_rtdn import GooglePlayRtdn, GooglePlayRtdnService, GooglePlayRtdnVerifier, decode_google_play_rtdn


Result = TypeVar("Result")


class StubPurchases:
    def __init__(self) -> None:
        self.calls: list[object] = []
        self.consumed: list[tuple[str, str]] = []
        self.reconciled: list[tuple[object, object]] = []
        self.order: object | None = None

    async def apply(self, user: object, subject_hash: str, order: object, product: object) -> CreditPurchaseResult:
        self.calls.append((user, subject_hash, order, product))
        return CreditPurchaseResult("purchase-token", "granted", 550, 500, 50, 0)

    async def provider_purchase(self, user_id: object, provider: str, order_id: str) -> object:
        return SimpleNamespace(provider_consumed_at=None)

    async def mark_provider_consumed(self, provider: str, order_id: str) -> None:
        self.consumed.append((provider, order_id))

    async def provider_order(self, provider: str, order_id: str) -> object | None:
        return self.order

    async def reconcile(self, purchase_id: object, order: object) -> None:
        self.reconciled.append((purchase_id, order))


class StubGooglePlayApi:
    def __init__(self, purchase: GooglePlayPurchase) -> None:
        self.purchase = purchase
        self.consumed: list[tuple[str, str]] = []

    async def get_purchase(self, purchase_token: str) -> GooglePlayPurchase:
        assert purchase_token == self.purchase.purchase_token
        return self.purchase

    async def consume(self, product_id: str, purchase_token: str) -> None:
        self.consumed.append((product_id, purchase_token))


def test_google_play_configuration_requires_integration_flag() -> None:
    settings = Settings(_env_file=None, google_play_iap_purchase_enabled=True)
    with pytest.raises(ValueError, match="GOOGLE_PLAY_IAP_ENABLED"):
        validate_google_play_iap_configuration(settings)


def test_disabled_google_play_configuration_preserves_toss_purchase_availability(tmp_path: Path) -> None:
    settings = configured_toss_settings(tmp_path)
    validate_toss_iap_configuration(settings)
    validate_google_play_iap_configuration(settings)
    assert toss_iap_purchase_available(settings, UserProvider.toss, "toss-user") is True
    assert google_play_iap_purchase_available(settings, "google-user") is False


def test_google_play_configuration_requires_service_account_file() -> None:
    settings = configured_settings("/missing/service-account.json")
    with pytest.raises(ValueError, match="SERVICE_ACCOUNT_JSON_PATH"):
        validate_google_play_iap_configuration(settings)


def test_google_play_configuration_requires_package_name() -> None:
    settings = configured_settings("/tmp/service-account.json")
    settings.google_play_iap_package_name = ""
    with pytest.raises(ValueError, match="PACKAGE_NAME"):
        validate_google_play_iap_configuration(settings)


def test_google_play_purchase_configuration_is_valid(tmp_path: Path) -> None:
    credential_file = tmp_path / "service-account.json"
    credential_file.write_text('{"client_email":"service@example.com","private_key":"key","private_key_id":"id"}')
    validate_google_play_iap_configuration(configured_settings(str(credential_file)))


def test_google_play_rtdn_configuration_requires_audience_and_push_identity(tmp_path: Path) -> None:
    credential_file = tmp_path / "service-account.json"
    credential_file.write_text('{"client_email":"service@example.com","private_key":"key","private_key_id":"id"}')
    settings = configured_settings(str(credential_file))
    settings.google_play_rtdn_enabled = True
    with pytest.raises(ValueError, match="RTDN_AUDIENCE"):
        validate_google_play_iap_configuration(settings)
    settings.google_play_rtdn_audience = "https://alive.example/api/credits/purchases/google-play/rtdn"
    with pytest.raises(ValueError, match="PUSH_SERVICE_ACCOUNT_EMAIL"):
        validate_google_play_iap_configuration(settings)
    settings.google_play_rtdn_push_service_account_email = "rtdn@project.iam.gserviceaccount.com"
    validate_google_play_iap_configuration(settings)


def test_google_play_rollout_is_stable_and_requires_enabled_purchase() -> None:
    settings = configured_settings("/tmp/service-account.json")
    settings.google_play_iap_purchase_rollout_percent = 50
    first = google_play_iap_purchase_available(settings, "user-1")
    assert google_play_iap_purchase_available(settings, "user-1") is first
    settings.google_play_iap_purchase_enabled = False
    assert google_play_iap_purchase_available(settings, "user-1") is False


def test_google_play_purchase_parser_requires_one_known_product() -> None:
    payload = {"productLineItem": [{"productId": "alive.credits.500"}], "purchaseStateContext": {"purchaseState": "PURCHASED"}, "obfuscatedExternalAccountId": "account"}
    purchase = google_play_purchase(payload, "purchase-token")
    assert purchase == GooglePlayPurchase("purchase-token", "alive.credits.500", "PURCHASED", "account")


def test_google_play_consume_accepts_empty_success_response() -> None:
    response = httpx.Response(200, content=b"")
    assert _publisher_response(response, allow_empty=True) == {}


def test_google_play_service_verifies_identity_grants_and_consumes() -> None:
    settings = configured_settings("/tmp/service-account.json")
    user = SimpleNamespace(id=uuid4())
    purchase = GooglePlayPurchase("purchase-token", "alive.credits.500", "PURCHASED", google_play_account_id(settings, user.id))
    repository = StubPurchases()
    api = StubGooglePlayApi(purchase)
    service = GooglePlayCreditPurchaseService(settings, repository, api)  # type: ignore[arg-type]
    result = run(service.grant(user, purchase.purchase_token))
    order = repository.calls[0][2]
    assert (result.status, order.provider, order.status) == ("granted", GOOGLE_PLAY_PURCHASE_PROVIDER, "PAYMENT_COMPLETED")
    assert api.consumed == [("alive.credits.500", "purchase-token")]
    assert repository.consumed == [(GOOGLE_PLAY_PURCHASE_PROVIDER, "purchase-token")]


def test_google_play_service_rejects_purchase_for_another_account() -> None:
    settings = configured_settings("/tmp/service-account.json")
    user = SimpleNamespace(id=uuid4())
    purchase = GooglePlayPurchase("purchase-token", "alive.credits.500", "PURCHASED", "another-account")
    service = GooglePlayCreditPurchaseService(settings, StubPurchases(), StubGooglePlayApi(purchase))  # type: ignore[arg-type]
    with pytest.raises(ForbiddenError, match="does not belong"):
        run(service.grant(user, purchase.purchase_token))


def test_google_play_product_mapping_uses_only_configured_product_ids() -> None:
    settings = configured_settings("/tmp/service-account.json")
    assert credit_product_by_google_play_id(settings, "alive.credits.500").offer_id == "credit-5000"
    assert credit_product_by_google_play_id(settings, "unconfigured") is None


def test_google_play_rtdn_decoder_accepts_one_time_and_voided_events() -> None:
    purchased = rtdn_payload({"oneTimeProductNotification": {"notificationType": 1, "purchaseToken": "purchase-token"}})
    voided = rtdn_payload({"voidedPurchaseNotification": {"productType": 2, "purchaseToken": "purchase-token"}})
    assert decode_google_play_rtdn(purchased, "com.ashwoodfriends.alive") == GooglePlayRtdn("one_time_purchased", "purchase-token")
    assert decode_google_play_rtdn(voided, "com.ashwoodfriends.alive") == GooglePlayRtdn("voided", "purchase-token")


def test_google_play_rtdn_decoder_rejects_another_package() -> None:
    payload = rtdn_payload({"oneTimeProductNotification": {"notificationType": 1, "purchaseToken": "purchase-token"}}, package_name="other.app")
    with pytest.raises(BadRequestError, match="package"):
        decode_google_play_rtdn(payload, "com.ashwoodfriends.alive")


def test_google_play_rtdn_verifier_requires_google_service_account(monkeypatch: pytest.MonkeyPatch) -> None:
    token, public_key = rtdn_token()
    class StubJWKClient:
        def __init__(self, url: str) -> None:
            self.url = url
        def get_signing_key_from_jwt(self, payload: str) -> object:
            return SimpleNamespace(key=public_key)
    monkeypatch.setattr("app.services.google_play_rtdn.PyJWKClient", StubJWKClient)
    verifier = GooglePlayRtdnVerifier(rtdn_settings())
    verifier.verify(f"Bearer {token}")
    with pytest.raises(UnauthorizedError, match="required"):
        verifier.verify("")


def test_google_play_rtdn_verifier_retries_when_google_keys_are_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    from jwt.exceptions import PyJWKClientConnectionError
    class UnavailableJWKClient:
        def __init__(self, url: str) -> None:
            self.url = url
        def get_signing_key_from_jwt(self, payload: str) -> object:
            raise PyJWKClientConnectionError("offline")
    monkeypatch.setattr("app.services.google_play_rtdn.PyJWKClient", UnavailableJWKClient)
    with pytest.raises(ServiceUnavailableError, match="unavailable"):
        GooglePlayRtdnVerifier(rtdn_settings()).verify("Bearer signed-push")


def test_google_play_rtdn_service_routes_purchase_and_refund() -> None:
    service = object.__new__(GooglePlayRtdnService)
    received: list[tuple[str, str]] = []
    service.purchases = SimpleNamespace(process_purchase=lambda token: async_append(received, ("purchase", token)), process_refund=lambda token: async_append(received, ("refund", token)))
    assert run(service._apply(GooglePlayRtdn("one_time_purchased", "purchase-token"))) is None
    assert run(service._apply(GooglePlayRtdn("voided", "purchase-token"))) is None
    assert received == [("purchase", "purchase-token"), ("refund", "purchase-token")]


def test_google_play_rtdn_purchase_service_grants_and_consumes_verified_purchase() -> None:
    settings = configured_settings("/tmp/service-account.json")
    settings.google_play_rtdn_enabled = True
    user = SimpleNamespace(id=uuid4())
    purchase = GooglePlayPurchase("purchase-token", "alive.credits.500", "PURCHASED", google_play_account_id(settings, user.id))
    repository = StubPurchases()
    accounts = SimpleNamespace(user=lambda account_id: async_value(user))
    service = GooglePlayRtdnPurchaseService(settings, repository, accounts, StubGooglePlayApi(purchase))  # type: ignore[arg-type]
    assert run(service.process_purchase(purchase.purchase_token)) == "granted"
    assert repository.consumed == [(GOOGLE_PLAY_PURCHASE_PROVIDER, "purchase-token")]


def test_google_play_rtdn_purchase_service_refunds_only_existing_purchase() -> None:
    settings = configured_settings("/tmp/service-account.json")
    settings.google_play_rtdn_enabled = True
    repository = StubPurchases()
    repository.order = SimpleNamespace(id=uuid4(), sku="alive.credits.500")
    service = GooglePlayRtdnPurchaseService(settings, repository, SimpleNamespace(), StubGooglePlayApi(GooglePlayPurchase("unused", "alive.credits.500", "PURCHASED", "account")))  # type: ignore[arg-type]
    assert run(service.process_refund("purchase-token")) == "refunded"
    assert repository.reconciled[0][1].status == "REFUNDED"


def configured_settings(credential_path: str) -> Settings:
    return Settings(_env_file=None, google_play_iap_enabled=True, google_play_iap_purchase_enabled=True, google_play_iap_purchase_rollout_percent=100, google_play_iap_service_account_json_path=credential_path, google_play_iap_subject_hmac_key="stable-google-play-secret-at-least-32", google_play_iap_credit_5000_product_id="alive.credits.500", google_play_iap_credit_10000_product_id="alive.credits.1000", google_play_iap_credit_30000_product_id="alive.credits.3150", google_play_iap_credit_50000_product_id="alive.credits.5500", google_play_iap_credit_100000_product_id="alive.credits.11500")


def configured_toss_settings(tmp_path: Path) -> Settings:
    certificate = tmp_path / "certificate.pem"
    private_key = tmp_path / "private-key.pem"
    certificate.write_text("certificate")
    private_key.write_text("private-key")
    return Settings(_env_file=None, toss_iap_enabled=True, toss_iap_purchase_enabled=True, toss_iap_purchase_rollout_percent=100, toss_iap_reconciliation_enabled=True, toss_iap_audit_alerts_enabled=True, toss_mtls_cert_path=str(certificate), toss_mtls_key_path=str(private_key), toss_iap_credit_5000_sku="sku-500", toss_iap_credit_10000_sku="sku-1000", toss_iap_credit_30000_sku="sku-3000", toss_iap_credit_50000_sku="sku-5000", toss_iap_credit_100000_sku="sku-10000", toss_iap_subject_hmac_key="stable-toss-secret-at-least-32-bytes")


def rtdn_payload(notification: dict[str, object], package_name: str = "com.ashwoodfriends.alive") -> str:
    payload = {"packageName": package_name, **notification}
    return base64.b64encode(json.dumps(payload).encode()).decode()


def rtdn_settings() -> Settings:
    return Settings(_env_file=None, google_play_rtdn_audience="https://alive.example/api/credits/purchases/google-play/rtdn", google_play_rtdn_push_service_account_email="rtdn@project.iam.gserviceaccount.com", oauth_jwt_leeway_seconds=10**9)


def rtdn_token() -> tuple[str, object]:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    now = datetime.now(timezone.utc)
    claims = {"iss": "https://accounts.google.com", "aud": rtdn_settings().google_play_rtdn_audience, "iat": now, "exp": now + timedelta(minutes=5), "email": rtdn_settings().google_play_rtdn_push_service_account_email, "email_verified": True}
    return jwt.encode(claims, private_key, algorithm="RS256", headers={"kid": "google-key"}), private_key.public_key()


async def async_append(target: list[tuple[str, str]], value: tuple[str, str]) -> None:
    target.append(value)


async def async_value(value: object) -> object:
    return value


def run(coroutine: Coroutine[object, object, Result]) -> Result:
    return asyncio.run(coroutine)
