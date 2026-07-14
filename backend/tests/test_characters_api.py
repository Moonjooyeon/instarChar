from collections.abc import AsyncIterator
from dataclasses import dataclass
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.db.session import get_db_session
from app.main import app
from app.models import UserProvider
from app.repositories.profile_state import ProfileStateRepository


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


def test_delete_character_data_cleans_structured_rows(monkeypatch) -> None:
    calls = []

    async def delete_character_data(self: object, user: StubUser, source_account_id: str) -> None:
        calls.append((user.email, source_account_id))

    monkeypatch.setattr(ProfileStateRepository, "delete_character_data", delete_character_data)
    with make_test_client() as client:
        response = client.delete("/api/characters/char-1")
    assert response.status_code == 204
    assert calls == [("tester@example.com", "char-1")]


def make_test_client() -> TestClient:
    app.dependency_overrides[get_db_session] = stub_db_session
    app.dependency_overrides[get_current_user] = stub_current_user
    return TestClient(app)
