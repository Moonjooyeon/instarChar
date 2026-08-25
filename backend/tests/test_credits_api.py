import asyncio
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient
import pytest

from app.api.deps import get_current_user
from app.api.v1.credits import _offers, get_credit_catalog
from app.core.config import Settings
from app.db.session import get_db_session
from app.main import app
from app.models import CreditPurchase, CreditUsage, UserProvider
from app.repositories.credit_purchases import CreditPurchaseRepository, CreditPurchaseResult
from app.repositories.credits import CreditRepository
from app.services.credit_purchases import CreditPurchaseService


class StubUser:
    def __init__(self) -> None:
        self.id = uuid4()
        self.provider = UserProvider.toss
        self.provider_subject = "toss-user"


class StubSession:
    pass


async def stub_db_session() -> AsyncIterator[StubSession]:
    yield StubSession()


async def stub_current_user() -> StubUser:
    return StubUser()


def test_credit_balance_returns_energy_and_separate_balances(monkeypatch: pytest.MonkeyPatch) -> None:
    async def snapshot(self: object, user_id: object) -> dict[str, object]:
        missions = [{"code": "signup", "credits": 50, "completed": True}, {"code": "first_character", "credits": 50, "completed": False}, {"code": "first_dm", "credits": 50, "completed": False}]
        return {"purchased_credits": 50, "bonus_credits": 300, "total_credits": 350, "energy_percent": 75, "energy_max_percent": 100, "next_energy_recovery_at": datetime(2026, 8, 10, tzinfo=timezone.utc), "credit_policy_version": "credit-v1", "energy_policy_version": "energy-v1", "reward_missions": missions}
    monkeypatch.setattr(CreditRepository, "snapshot", snapshot)
    with make_test_client() as client:
        response = client.get("/api/credits")
    assert response.status_code == 200
    assert response.json()["total_credits"] == 350
    assert response.json()["energy_percent"] == 75
    assert [item["completed"] for item in response.json()["reward_missions"]] == [True, False, False]


def test_credit_catalog_is_visible_but_payment_is_disabled() -> None:
    with make_test_client() as client:
        response = client.get("/api/credits/catalog")
    assert response.status_code == 200
    assert len(response.json()["offers"]) == 5
    assert [offer["price_krw"] for offer in response.json()["offers"]] == [5390, 10890, 32450, 54450, 108900]
    assert all(offer["payment_available"] is False for offer in response.json()["offers"])
    assert response.json()["offers"][2]["first_purchase_total_credits"] == 3465
    assert response.json()["flows"][0]["code"] == "direct_dm_basic"
    pro = next(flow for flow in response.json()["flows"] if flow["code"] == "direct_dm_pro")
    assert pro["label"] == "중요한 답장"
    assert pro["credits"] == 9
    assert pro["energy_eligible"] is False
    assert pro["bonus_eligible"] is False
    auto = next(flow for flow in response.json()["flows"] if flow["code"] == "auto_feed_post")
    assert (auto["label"], auto["credits"], auto["energy_percent"]) == ("혼자 남기는 근황", 2, 25)
    assert (auto["energy_eligible"], auto["bonus_eligible"]) == (True, True)
    analysis = next(flow for flow in response.json()["flows"] if flow["code"] == "character_analysis")
    assert (analysis["credits"], analysis["intro_free_uses"], analysis["hard_daily_limit"]) == (10, 1, 3)
    assert [flow["code"] for flow in response.json()["flows"] if flow["code"].startswith("direct_dm")] == ["direct_dm_basic", "direct_dm_context", "direct_dm_pro"]


def test_credit_catalog_enables_only_configured_products() -> None:
    settings = Settings(_env_file=None, toss_iap_enabled=True, toss_iap_purchase_enabled=True, toss_iap_credit_5000_sku="sku-500")
    offers = _offers(settings, True)
    assert (offers[0].sku, offers[0].payment_available) == ("sku-500", True)
    assert all(offer.payment_available is False for offer in offers[1:])


def test_credit_catalog_applies_user_rollout_eligibility() -> None:
    settings = Settings(_env_file=None, toss_iap_enabled=True, toss_iap_purchase_enabled=True, toss_iap_purchase_rollout_percent=100, toss_iap_credit_5000_sku="sku-500")
    user = StubUser()
    enabled = asyncio.run(get_credit_catalog(user, settings))  # type: ignore[arg-type]
    user.provider = UserProvider.google
    disabled = asyncio.run(get_credit_catalog(user, settings))  # type: ignore[arg-type]
    assert enabled.offers[0].payment_available is True
    assert disabled.offers[0].payment_available is False
    assert disabled.offers[0].sku == "sku-500"


def test_credit_catalog_can_stop_new_orders_without_disabling_recovery() -> None:
    settings = Settings(_env_file=None, toss_iap_enabled=True, toss_iap_purchase_enabled=False, toss_iap_credit_5000_sku="sku-500")
    offer = _offers(settings, False)[0]
    assert (offer.sku, offer.payment_available) == ("sku-500", False)


def test_credit_catalog_hides_provider_skus_when_integration_is_disabled() -> None:
    settings = Settings(_env_file=None, toss_iap_enabled=False, toss_iap_purchase_enabled=True, toss_iap_credit_5000_sku="sku-500")
    offer = _offers(settings, True)[0]
    assert (offer.sku, offer.payment_available) == ("", False)


def test_credit_purchase_grant_returns_server_balance(monkeypatch: pytest.MonkeyPatch) -> None:
    requested: list[tuple[str, str, str]] = []
    async def grant(self: object, user: object, order_id: str, sku: str, environment: str) -> CreditPurchaseResult:
        requested.append((order_id, sku, environment))
        return CreditPurchaseResult(order_id, "granted", 550, 500, 50, 0)
    monkeypatch.setattr(CreditPurchaseService, "grant", grant)
    with make_test_client() as client:
        response = client.post("/api/credits/purchases/grant", json={"order_id": "order-1", "sku": "sku-500", "environment": "sandbox"})
    assert response.status_code == 200
    assert requested == [("order-1", "sku-500", "sandbox")]
    assert response.json() == {"order_id": "order-1", "status": "granted", "granted_credits": 550, "purchased_credits": 500, "bonus_credits": 50, "debt_credits": 0, "total_credits": 550}


def test_credit_purchase_grant_rejects_unknown_operational_environment() -> None:
    with make_test_client() as client:
        response = client.post("/api/credits/purchases/grant", json={"order_id": "order-1", "sku": "sku-500", "environment": "web"})
    assert response.status_code == 422


def test_google_play_rtdn_forwards_only_pubsub_message_and_authorization(monkeypatch: pytest.MonkeyPatch) -> None:
    received: list[tuple[str, str, str]] = []
    class StubRtdnService:
        def __init__(self, settings: object, session: object) -> None:
            return None
        async def process(self, authorization: str, message_id: str, data: str) -> None:
            received.append((authorization, message_id, data))
    monkeypatch.setattr("app.api.v1.credits.GooglePlayRtdnService", StubRtdnService)
    with make_test_client() as client:
        response = client.post("/api/credits/purchases/google-play/rtdn", headers={"Authorization": "Bearer signed-push"}, json={"message": {"messageId": "event-1", "data": "cHVibGlzaGVk"}})
    assert response.status_code == 204
    assert received == [("Bearer signed-push", "event-1", "cHVibGlzaGVk")]


def test_app_store_notifications_accept_apple_signed_payload_field(monkeypatch: pytest.MonkeyPatch) -> None:
    received: list[str] = []
    class StubNotificationService:
        def __init__(self, settings: object, session: object) -> None:
            return None
        async def process(self, signed_payload: str) -> None:
            received.append(signed_payload)
    monkeypatch.setattr("app.api.v1.credits.AppStoreNotificationService", StubNotificationService)
    with make_test_client() as client:
        response = client.post("/api/credits/purchases/app-store/notifications", json={"signedPayload": "apple-jws"})
    assert response.status_code == 204
    assert received == ["apple-jws"]


def test_credit_purchase_history_is_scoped_to_current_user(monkeypatch: pytest.MonkeyPatch) -> None:
    requested_users: list[object] = []
    created_at = datetime(2026, 8, 11, tzinfo=timezone.utc)
    async def history(self: object, user_id: object, limit: int = 30) -> list[CreditPurchase]:
        requested_users.append(user_id)
        return [CreditPurchase(provider_order_id="order-1", provider_subject_hash="hash", sku="sku-500", status="granted", provider_status="PURCHASED", price_krw=5000, base_credits=500, product_bonus_credits=0, first_purchase_bonus_credits=50, granted_credits=550, chargeback_credits=0, failure_reason="", created_at=created_at)]
    monkeypatch.setattr(CreditPurchaseRepository, "history", history)
    with make_test_client() as client:
        response = client.get("/api/credits/purchases")
    assert response.status_code == 200
    assert len(requested_users) == 1
    assert response.json()["items"][0]["granted_credits"] == 550
    assert "failure_reason" not in response.json()["items"][0]


def test_credit_usage_returns_separate_balance_sources(monkeypatch: pytest.MonkeyPatch) -> None:
    created_at = datetime(2026, 8, 9, tzinfo=timezone.utc)
    async def usages(self: object, user_id: object, limit: int = 30) -> list[CreditUsage]:
        return [CreditUsage(id=uuid4(), user_id=uuid4(), flow="feed_post", policy_version="v2", model="flash", status="refunded", credits=3, energy_percent=0, bonus_credits=2, purchased_credits=1, idempotency_key="usage-1", created_at=created_at)]
    monkeypatch.setattr(CreditRepository, "usages", usages)
    with make_test_client() as client:
        response = client.get("/api/credits/usage")
    assert response.status_code == 200
    assert response.json()["items"][0]["bonus_credits"] == 2
    assert response.json()["items"][0]["purchased_credits"] == 1


def make_test_client() -> TestClient:
    app.dependency_overrides[get_db_session] = stub_db_session
    app.dependency_overrides[get_current_user] = stub_current_user
    return TestClient(app)
