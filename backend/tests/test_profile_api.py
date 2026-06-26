from collections.abc import AsyncIterator
from dataclasses import dataclass
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.db.session import get_db_session
from app.main import app
from app.models import UserProvider
from app.repositories.profile_state import ProfileStateRepository
from app.schemas.profile import ProfileStateResponse


@dataclass
class StubProfile:
    display_name: str = "테스터"
    onboarded: bool = True
    app_state: dict[str, object] = None


@dataclass
class StubUser:
    id: object
    email: str
    provider: UserProvider
    profile: StubProfile


class StubSession:
    async def commit(self) -> None:
        return None


async def stub_db_session() -> AsyncIterator[StubSession]:
    yield StubSession()


async def stub_current_user() -> StubUser:
    return StubUser(id=uuid4(), email="tester@example.com", provider=UserProvider.google, profile=StubProfile())


def test_get_profile_state_returns_saved_shape(monkeypatch) -> None:
    async def get_state(self: object, user: StubUser) -> ProfileStateResponse:
        return ProfileStateResponse(display_name="테스터", onboarded=True, app_state={"accounts": []}, characters=[], personas=[], dm_threads=[], shared_dm_threads=[])

    monkeypatch.setattr(ProfileStateRepository, "get_state", get_state)
    with make_test_client() as client:
        response = client.get("/api/profile/state")
    assert response.status_code == 200
    assert response.json()["display_name"] == "테스터"
    assert response.json()["app_state"] == {"accounts": []}


def test_update_profile_state_accepts_app_state(monkeypatch) -> None:
    calls = []

    async def update_state(self: object, user: StubUser, payload: object) -> None:
        calls.append(payload)

    monkeypatch.setattr(ProfileStateRepository, "update_state", update_state)
    body = {"display_name": "alive", "onboarded": True, "app_state": {"accounts": [{"id": "a"}]}}
    with make_test_client() as client:
        response = client.put("/api/profile/state", json=body)
    assert response.status_code == 204
    assert calls[0].display_name == "alive"


def test_update_structured_state_accepts_rows(monkeypatch) -> None:
    calls = []

    async def upsert_structured_state(self: object, user: StubUser, payload: object) -> None:
        calls.append(payload)

    monkeypatch.setattr(ProfileStateRepository, "upsert_structured_state", upsert_structured_state)
    body = {"characters": [{"source_account_id": "char-1", "name": "A"}], "personas": [], "dm_threads": [], "shared_dm_threads": []}
    with make_test_client() as client:
        response = client.post("/api/profile/structured-state", json=body)
    assert response.status_code == 204
    assert calls[0].characters[0].source_account_id == "char-1"


def test_update_onboarding_sets_display_name(monkeypatch) -> None:
    calls = []

    async def update_onboarding(self: object, user: StubUser, display_name: str) -> None:
        calls.append(display_name)

    monkeypatch.setattr(ProfileStateRepository, "update_onboarding", update_onboarding)
    with make_test_client() as client:
        response = client.post("/api/profile/onboarding", json={"display_name": "alive"})
    assert response.status_code == 204
    assert calls == ["alive"]


def make_test_client() -> TestClient:
    app.dependency_overrides[get_db_session] = stub_db_session
    app.dependency_overrides[get_current_user] = stub_current_user
    return TestClient(app)
