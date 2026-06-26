from collections.abc import AsyncIterator
from dataclasses import dataclass
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.core.errors import ForbiddenError
from app.db.session import get_db_session
from app.main import app
from app.models import UserProvider
from app.repositories.dm_threads import DmThreadRepository


@dataclass
class StubProfile:
    display_name: str = "테스터"
    onboarded: bool = True


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


def test_get_owner_dm_thread_uses_query_thread_key(monkeypatch) -> None:
    async def get_owner_thread(self: object, user: StubUser, thread_key: str) -> object:
        assert thread_key == "owner::char-1::tester"
        return SimpleNamespace(id=uuid4(), thread_key=thread_key, messages=[{"text": "hi"}], world_pref={})

    monkeypatch.setattr(DmThreadRepository, "get_owner_thread", get_owner_thread)
    with make_test_client() as client:
        response = client.get("/api/dm-threads", params={"thread_key": "owner::char-1::tester"})
    assert response.status_code == 200
    assert response.json()["messages"] == [{"text": "hi"}]


def test_upsert_owner_dm_thread_accepts_payload(monkeypatch) -> None:
    calls = []

    async def upsert_owner_thread(self: object, user: StubUser, payload: object) -> None:
        calls.append(payload.thread_key)

    monkeypatch.setattr(DmThreadRepository, "upsert_owner_thread", upsert_owner_thread)
    with make_test_client() as client:
        response = client.put("/api/dm-threads", json={"thread_key": "owner::a::b", "messages": [], "world_pref": {}})
    assert response.status_code == 204
    assert calls == ["owner::a::b"]


def test_delete_owner_dm_thread_uses_query_thread_key(monkeypatch) -> None:
    calls = []

    async def delete_owner_thread(self: object, user: StubUser, thread_key: str) -> None:
        calls.append(thread_key)

    monkeypatch.setattr(DmThreadRepository, "delete_owner_thread", delete_owner_thread)
    with make_test_client() as client:
        response = client.delete("/api/dm-threads", params={"thread_key": "owner::a::b"})
    assert response.status_code == 204
    assert calls == ["owner::a::b"]


def test_get_shared_dm_thread_requires_participant(monkeypatch) -> None:
    async def get_shared_thread(self: object, user: StubUser, thread_key: str) -> object:
        raise ForbiddenError("Shared DM participant required")

    monkeypatch.setattr(DmThreadRepository, "get_shared_thread", get_shared_thread)
    with make_test_client() as client:
        response = client.get("/api/shared-dm-threads", params={"thread_key": "dm::a|b"})
    assert response.status_code == 403


def test_upsert_shared_dm_thread_accepts_payload(monkeypatch) -> None:
    calls = []

    async def upsert_shared_thread(self: object, user: StubUser, payload: object) -> None:
        calls.append(payload.participant_labels)

    monkeypatch.setattr(DmThreadRepository, "upsert_shared_thread", upsert_shared_thread)
    body = {"thread_key": "dm::a|b", "messages": [], "world_pref": {}, "participant_user_ids": [], "participant_labels": ["a", "b"]}
    with make_test_client() as client:
        response = client.put("/api/shared-dm-threads", json=body)
    assert response.status_code == 204
    assert calls == [["a", "b"]]


def test_delete_shared_dm_thread_requires_participant(monkeypatch) -> None:
    async def delete_shared_thread(self: object, user: StubUser, thread_key: str) -> None:
        raise ForbiddenError("Shared DM participant required")

    monkeypatch.setattr(DmThreadRepository, "delete_shared_thread", delete_shared_thread)
    with make_test_client() as client:
        response = client.delete("/api/shared-dm-threads", params={"thread_key": "dm::a|b"})
    assert response.status_code == 403


def test_repository_rejects_shared_dm_non_participant() -> None:
    repo = DmThreadRepository(StubSession())
    user = StubUser(id=uuid4(), email="tester@example.com", provider=UserProvider.google, profile=StubProfile())
    row = SimpleNamespace(participant_user_ids=[uuid4()])
    try:
        repo._require_shared_participant(user, row)
    except ForbiddenError:
        return
    raise AssertionError("expected ForbiddenError")


def make_test_client() -> TestClient:
    app.dependency_overrides[get_db_session] = stub_db_session
    app.dependency_overrides[get_current_user] = stub_current_user
    return TestClient(app)
