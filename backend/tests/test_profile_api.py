from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from dataclasses import dataclass
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.dialects import postgresql

from app.api.deps import get_current_user
from app.db.session import get_db_session
from app.main import app
from app.models import SharedDmThread, UserProvider
from app.repositories.profile_state import ProfileStateRepository
from app.schemas.profile import ProfileStateResponse
from app.schemas.profile import StructuredStateUpdate


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


def test_shared_dm_thread_participant_lookup_uses_postgresql_array() -> None:
    stmt = select(SharedDmThread).where(SharedDmThread.participant_user_ids.contains([uuid4()]))
    compiled = str(stmt.compile(dialect=postgresql.dialect()))
    assert "@>" in compiled


def test_structured_character_upsert_does_not_update_posts() -> None:
    session = CaptureSession()
    payload = StructuredStateUpdate(characters=[{"source_account_id": "char-1", "name": "세인", "posts": [{"text": "stale"}]}])
    asyncio.run(ProfileStateRepository(session)._upsert_characters(uuid4(), payload))
    compiled = str(session.statement.compile(dialect=postgresql.dialect()))
    update_clause = compiled.split("DO UPDATE SET", 1)[1]
    assert "posts =" not in update_clause
    assert "handle =" not in update_clause


def test_legacy_character_row_uses_server_assigned_handle() -> None:
    item = StructuredStateUpdate(characters=[{"source_account_id": "char-1", "name": "세인", "handle": "stale", "character": {"handle": "stale"}}]).characters[0]
    row = ProfileStateRepository(CaptureSession())._character_row(uuid4(), item, "server-handle")
    assert row["handle"] == "server-handle"
    assert row["character"]["handle"] == "server-handle"


def test_legacy_new_characters_receive_unique_handles() -> None:
    session = CaptureSession(existing_rows=[], used_handles=["hero", "character"])
    payload = StructuredStateUpdate(characters=[{"source_account_id": "one", "handle": "Hero"}, {"source_account_id": "two", "handle": ""}])
    handles = asyncio.run(ProfileStateRepository(session)._character_handles_for_write(uuid4(), payload.characters))
    assert handles == {"one": "hero-2", "two": "character-2"}


def test_legacy_existing_character_keeps_database_handle() -> None:
    session = CaptureSession(existing_rows=[("one", "database-handle")], used_handles=["database-handle"])
    payload = StructuredStateUpdate(characters=[{"source_account_id": "one", "handle": "stale"}])
    handles = asyncio.run(ProfileStateRepository(session)._character_handles_for_write(uuid4(), payload.characters))
    assert handles == {"one": "database-handle"}


def test_character_follow_rows_are_rebuilt_from_structured_characters() -> None:
    user = asyncio.run(stub_current_user())
    shared_id = uuid4()
    payload = StructuredStateUpdate(characters=[{"source_account_id": "char-1", "name": "하루", "character": {"name": "하루"}, "following": [{"name": "세라", "sharedId": str(shared_id)}]}])
    rows = ProfileStateRepository(CaptureSession())._character_follow_rows(user, payload)
    assert rows == [{"follower_id": user.id, "follower_name": "테스터", "follower_account_id": "char-1", "follower_character": {"name": "하루", "handle": ""}, "target_shared_character_id": shared_id}]


def test_character_follow_rows_ignore_unshared_characters() -> None:
    user = asyncio.run(stub_current_user())
    payload = StructuredStateUpdate(characters=[{"source_account_id": "char-1", "name": "하루", "following": [{"name": "세라", "sharedId": ""}]}])
    rows = ProfileStateRepository(CaptureSession())._character_follow_rows(user, payload)
    assert rows == []


class CaptureSession:
    def __init__(self, existing_rows: list[tuple[str, str]] | None = None, used_handles: list[str] | None = None) -> None:
        self.statement: object = None
        self.existing_rows = existing_rows or []
        self.used_handles = used_handles or []
        self.call_count = 0

    async def execute(self, statement: object) -> object:
        self.statement = statement
        self.call_count += 1
        if self.call_count == 1:
            return CaptureResult(self.existing_rows)
        return CaptureResult(self.used_handles)


class CaptureResult:
    def __init__(self, rows: list[object]) -> None:
        self.rows = rows

    def all(self) -> list[object]:
        return self.rows

    def scalars(self) -> CaptureResult:
        return self


def make_test_client() -> TestClient:
    app.dependency_overrides[get_db_session] = stub_db_session
    app.dependency_overrides[get_current_user] = stub_current_user
    return TestClient(app)
