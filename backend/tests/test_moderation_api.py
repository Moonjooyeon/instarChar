from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.session import get_db_session
from app.main import app
from app.models import ReportStatus, UserProvider
from app.repositories.credit_purchases import CreditAccountAuditItem, CreditPurchaseAuditItem, CreditPurchaseAuditReport, CreditPurchaseRepository
from app.repositories.moderation import ModerationRepository


@dataclass
class StubUser:
    id: object
    email: str = "reporter@example.com"
    provider: UserProvider = UserProvider.google


class StubSession:
    pass


class StubSettings:
    terms_version = "2026-07-24"
    moderation_api_key = "moderation-secret"
    moderation_actor = "test-operator"


async def stub_db_session() -> AsyncIterator[StubSession]:
    yield StubSession()


async def stub_current_user() -> StubUser:
    return StubUser(id=uuid4())


def stub_settings() -> StubSettings:
    return StubSettings()


def test_consent_status_and_acceptance(monkeypatch) -> None:
    async def consent_status(self: object, user_id: object, version: str) -> bool:
        return False
    async def accept_terms(self: object, user_id: object, version: str) -> None:
        assert version == "2026-07-24"
    monkeypatch.setattr(ModerationRepository, "consent_status", consent_status)
    monkeypatch.setattr(ModerationRepository, "accept_terms", accept_terms)
    with make_test_client() as client:
        current = client.get("/api/safety/consent")
        accepted = client.put("/api/safety/consent")
    assert current.json() == {"accepted": False, "terms_version": "2026-07-24"}
    assert accepted.json() == {"accepted": True, "terms_version": "2026-07-24"}


def test_report_endpoint_creates_pending_queue_item(monkeypatch) -> None:
    async def create_report(self: object, user_id: object, payload: object) -> object:
        return SimpleNamespace(id=uuid4(), status=ReportStatus.pending, created_at=datetime.now(timezone.utc))
    monkeypatch.setattr(ModerationRepository, "create_report", create_report)
    body = {"target_type": "post", "target_owner_id": str(uuid4()), "target_reference": "char:post", "reason": "harassment", "snapshot": {"text": "bad"}}
    with make_test_client() as client:
        response = client.post("/api/safety/reports", json=body)
    assert response.status_code == 201
    assert response.json()["status"] == "pending"


def test_block_endpoint_persists_target(monkeypatch) -> None:
    calls = []
    async def block_user(self: object, blocker_id: object, blocked_id: object) -> None:
        calls.append((blocker_id, blocked_id))
    monkeypatch.setattr(ModerationRepository, "block_user", block_user)
    target_id = uuid4()
    with make_test_client() as client:
        response = client.put(f"/api/safety/blocks/{target_id}")
    assert response.status_code == 204
    assert calls[0][1] == target_id


def test_moderation_queue_requires_configured_secret(monkeypatch) -> None:
    async def reports(self: object, report_status: object) -> list[object]:
        return []
    monkeypatch.setattr(ModerationRepository, "reports", reports)
    with make_test_client() as client:
        forbidden = client.get("/api/moderation/reports", headers={"X-Moderation-Key": "wrong"})
        allowed = client.get("/api/moderation/reports", headers={"X-Moderation-Key": "moderation-secret"})
    assert forbidden.status_code == 403
    assert allowed.json() == {"reports": []}


def test_credit_purchase_operations_returns_purchase_ledger_and_debt(monkeypatch) -> None:
    async def operations(self: object, order_id: str) -> object:
        purchase = SimpleNamespace(provider="apps_in_toss", provider_order_id=order_id, user_id=uuid4(), sku="sku-500", status="refunded", provider_status="REFUNDED", price_krw=5000, base_credits=500, product_bonus_credits=0, first_purchase_bonus_credits=50, granted_credits=550, chargeback_credits=550, failure_reason="", provider_checked_at=None, granted_at=None, refunded_at=None)
        account = SimpleNamespace(purchased_credits=0, bonus_credits=10, debt_credits=450)
        ledger = [SimpleNamespace(entry_type="chargeback", balance_type="purchased", amount=-550, idempotency_key=f"chargeback:{order_id}", created_at=datetime.now(timezone.utc))]
        return purchase, account, ledger
    monkeypatch.setattr(CreditPurchaseRepository, "operations", operations)
    with make_test_client() as client:
        response = client.get("/api/moderation/credit-purchases/order-1", headers={"X-Moderation-Key": "moderation-secret"})
    assert response.status_code == 200
    assert response.json()["purchase"]["provider"] == "apps_in_toss"
    assert response.json()["account"]["debt_credits"] == 450
    assert response.json()["ledger"][0]["amount"] == -550


def test_credit_purchase_operations_queue_filters_internal_status(monkeypatch) -> None:
    calls = []
    async def operations_queue(self: object, status: str | None, limit: int) -> list[object]:
        calls.append((status, limit))
        return [SimpleNamespace(provider="apps_in_toss", provider_order_id="order-review", user_id=None, sku="sku-500", status="review", provider_status="PURCHASED", price_krw=5000, base_credits=500, product_bonus_credits=0, first_purchase_bonus_credits=0, granted_credits=0, chargeback_credits=0, failure_reason="review", provider_checked_at=None, granted_at=None, refunded_at=None)]
    monkeypatch.setattr(CreditPurchaseRepository, "operations_queue", operations_queue)
    with make_test_client() as client:
        response = client.get("/api/moderation/credit-purchases?status=review&limit=20", headers={"X-Moderation-Key": "moderation-secret"})
    assert response.status_code == 200
    assert response.json()["purchases"][0]["status"] == "review"
    assert calls == [("review", 20)]


def test_credit_purchase_audit_returns_actionable_anomalies(monkeypatch) -> None:
    generated_at = datetime.now(timezone.utc)
    async def audit(self: object, limit: int) -> CreditPurchaseAuditReport:
        purchase = SimpleNamespace(provider="apps_in_toss", provider_order_id="order-stale", user_id=uuid4(), sku="sku-500", status="processing", provider_status="PAYMENT_COMPLETED", price_krw=5000, base_credits=500, product_bonus_credits=0, first_purchase_bonus_credits=0, granted_credits=0, chargeback_credits=0, failure_reason="", provider_checked_at=None, granted_at=None, refunded_at=None, created_at=generated_at)
        account = CreditAccountAuditItem(purchase.user_id, 100, 10, 50, 40, 10, ("purchased_balance_mismatch",))
        return CreditPurchaseAuditReport(generated_at, [CreditPurchaseAuditItem(purchase, ("stale_processing",))], [account], False)
    monkeypatch.setattr(CreditPurchaseRepository, "audit", audit)
    with make_test_client() as client:
        response = client.get("/api/moderation/credit-purchases/audit?limit=20", headers={"X-Moderation-Key": "moderation-secret"})
    assert response.status_code == 200
    assert response.json()["purchases"][0]["reasons"] == ["stale_processing"]
    assert response.json()["accounts"][0]["purchased_ledger_total"] == 40
    assert response.json()["accounts"][0]["reasons"] == ["purchased_balance_mismatch"]


def make_test_client() -> TestClient:
    app.dependency_overrides[get_db_session] = stub_db_session
    app.dependency_overrides[get_current_user] = stub_current_user
    app.dependency_overrides[get_settings] = stub_settings
    return TestClient(app)
