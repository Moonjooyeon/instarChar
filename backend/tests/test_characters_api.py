from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient
from pytest import MonkeyPatch

from app.api.deps import get_current_user
from app.core.errors import ConflictError
from app.db.session import get_db_session
from app.main import app
from app.models import UserProvider
from app.repositories.character_posts import CharacterPostsRepository
from app.repositories.profile_state import ProfileStateRepository
from app.schemas.character_posts import CharacterPostsResponse
from app.services.ai import GenerateApiResult
from app.services.feed_generation import FeedGenerationService


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


def test_get_character_posts_returns_authoritative_state(monkeypatch: MonkeyPatch) -> None:
    async def get(self: object, user: StubUser, source_account_id: str) -> CharacterPostsResponse:
        assert source_account_id == "char-1"
        return posts_response()

    monkeypatch.setattr(CharacterPostsRepository, "get", get)
    with make_test_client() as client:
        response = client.get("/api/characters/char-1/posts")
    assert response.status_code == 200
    assert response.json()["revision"] == 3
    assert response.json()["auto_post_interval_seconds"] == 1800


def test_save_character_posts_returns_conflict(monkeypatch: MonkeyPatch) -> None:
    async def save(self: object, user: StubUser, source_account_id: str, payload: object) -> CharacterPostsResponse:
        raise ConflictError("Post revision is stale")

    monkeypatch.setattr(CharacterPostsRepository, "save", save)
    with make_test_client() as client:
        response = client.put("/api/characters/char-1/posts", json={"posts": [], "revision": 1})
    assert response.status_code == 409
    assert response.json()["error"] == "CONFLICT"


def test_auto_post_accepts_only_supported_intervals(monkeypatch: MonkeyPatch) -> None:
    async def update_auto_post(self: object, user: StubUser, source_account_id: str, payload: object) -> CharacterPostsResponse:
        return posts_response()

    monkeypatch.setattr(CharacterPostsRepository, "update_auto_post", update_auto_post)
    with make_test_client() as client:
        accepted = client.patch("/api/characters/char-1/auto-post", json={"enabled": True, "interval_seconds": 1800})
        rejected = client.patch("/api/characters/char-1/auto-post", json={"enabled": True, "interval_seconds": 30})
    assert accepted.status_code == 200
    assert rejected.status_code == 422


def test_generate_character_post_uses_backend_service(monkeypatch: MonkeyPatch) -> None:
    async def generate(self: object, user: StubUser, source_account_id: str, payload: object) -> GenerateApiResult:
        return GenerateApiResult(200, {"post": {"text": "새 글"}})

    monkeypatch.setattr(FeedGenerationService, "generate", generate)
    with make_test_client() as client:
        response = client.post("/api/characters/char-1/posts/generate", json={"mood": "일상"})
    assert response.status_code == 200
    assert response.json()["post"]["text"] == "새 글"


def make_test_client() -> TestClient:
    app.dependency_overrides[get_db_session] = stub_db_session
    app.dependency_overrides[get_current_user] = stub_current_user
    return TestClient(app)


def posts_response() -> CharacterPostsResponse:
    return CharacterPostsResponse(
        posts=[{"text": "기존 글"}],
        revision=3,
        auto_post_enabled=True,
        auto_post_interval_seconds=1800,
        next_auto_post_at=datetime.now(timezone.utc),
    )
