from collections.abc import AsyncIterator
from datetime import datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient
import pytest

from app.api.deps import get_current_user
from app.db.session import get_db_session
from app.main import app
from app.models import CreditUsage
from app.repositories.credits import CreditRepository


class StubUser:
    def __init__(self) -> None:
        self.id = uuid4()


class StubSession:
    pass


async def stub_db_session() -> AsyncIterator[StubSession]:
    yield StubSession()


async def stub_current_user() -> StubUser:
    return StubUser()


def test_credit_balance_returns_energy_and_separate_balances(monkeypatch: pytest.MonkeyPatch) -> None:
    async def snapshot(self: object, user_id: object) -> dict[str, object]:
        return {"purchased_credits": 50, "bonus_credits": 300, "total_credits": 350, "energy_percent": 75, "energy_max_percent": 100, "next_energy_recovery_at": datetime(2026, 8, 10, tzinfo=timezone.utc), "credit_policy_version": "credit-v1", "energy_policy_version": "energy-v1"}
    monkeypatch.setattr(CreditRepository, "snapshot", snapshot)
    with make_test_client() as client:
        response = client.get("/api/credits")
    assert response.status_code == 200
    assert response.json()["total_credits"] == 350
    assert response.json()["energy_percent"] == 75


def test_credit_catalog_is_visible_but_payment_is_disabled() -> None:
    with make_test_client() as client:
        response = client.get("/api/credits/catalog")
    assert response.status_code == 200
    assert len(response.json()["offers"]) == 5
    assert all(offer["payment_available"] is False for offer in response.json()["offers"])
    assert response.json()["offers"][2]["first_purchase_total_credits"] == 3465
    assert response.json()["flows"][0]["code"] == "direct_dm_basic"
    pro = next(flow for flow in response.json()["flows"] if flow["code"] == "direct_dm_pro")
    story = next(flow for flow in response.json()["flows"] if flow["code"] == "direct_dm_pro_story")
    long = next(flow for flow in response.json()["flows"] if flow["code"] == "direct_dm_flash_long")
    assert long["credits"] == 2
    assert pro["credits"] == 5
    assert pro["energy_eligible"] is False
    assert pro["bonus_eligible"] is False
    assert story["credits"] == 7


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
