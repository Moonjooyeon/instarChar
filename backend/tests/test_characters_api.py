from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient
from pytest import MonkeyPatch

from app.api.deps import get_current_user
from app.core.errors import CharacterHandleTakenError, ConflictError
from app.db.session import get_db_session
from app.main import app
from app.models import UserProvider
from app.repositories.character_posts import CharacterPostsRepository
from app.repositories.characters import CharacterRepository
from app.repositories.credits import CreditRepository
from app.repositories.profile_state import ProfileStateRepository
from app.schemas.character_posts import CharacterPostCommentsResponse, CharacterPostsResponse
from app.schemas.characters import CharacterHandleAvailabilityResponse, CharacterVisibilityResponse, CharacterWriteResponse
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


def test_character_handle_availability_normalizes_input(monkeypatch: MonkeyPatch) -> None:
    async def availability(self: object, user: StubUser, handle: str, exclude_source_account_id: str) -> CharacterHandleAvailabilityResponse:
        assert (handle, exclude_source_account_id) == ("hero", "char-1")
        return CharacterHandleAvailabilityResponse(handle=handle, available=True)

    monkeypatch.setattr(CharacterRepository, "availability", availability)
    with make_test_client() as client:
        response = client.get("/api/characters/handle-availability?handle=%40Hero&exclude_source_account_id=char-1")
    assert response.status_code == 200
    assert response.json() == {"handle": "hero", "available": True}


def test_character_handle_availability_rejects_reserved_value() -> None:
    with make_test_client() as client:
        response = client.get("/api/characters/handle-availability?handle=admin")
    assert response.status_code == 422


def test_save_character_returns_authoritative_handle(monkeypatch: MonkeyPatch) -> None:
    grants: list[str] = []
    async def save(self: object, user: StubUser, source_account_id: str, payload: object) -> CharacterWriteResponse:
        return character_response(source_account_id, "hero")
    async def grant(self: object, user_id: object, event_code: str, credits: int) -> bool:
        grants.append(f"{event_code}:{credits}")
        return True

    monkeypatch.setattr(CharacterRepository, "save", save)
    monkeypatch.setattr(CreditRepository, "grant", grant)
    with make_test_client() as client:
        response = client.put("/api/characters/draft-1", json={"name": "Hero", "handle": "@Hero", "character": {"handle": "stale"}})
    assert response.status_code == 200
    assert response.json()["handle"] == "hero"
    assert grants == ["first_character:50"]


def test_save_character_returns_stable_handle_conflict(monkeypatch: MonkeyPatch) -> None:
    async def save(self: object, user: StubUser, source_account_id: str, payload: object) -> CharacterWriteResponse:
        raise CharacterHandleTakenError()

    monkeypatch.setattr(CharacterRepository, "save", save)
    with make_test_client() as client:
        response = client.put("/api/characters/draft-1", json={"name": "Hero", "handle": "hero"})
    assert response.status_code == 409
    assert response.json()["error"] == "CHARACTER_HANDLE_TAKEN"


def test_character_visibility_updates_the_server_owned_setting(monkeypatch: MonkeyPatch) -> None:
    async def update_visibility(self: object, user: StubUser, source_account_id: str, is_public: bool) -> CharacterVisibilityResponse:
        assert source_account_id == "char-1"
        assert is_public is False
        return CharacterVisibilityResponse(is_public=False)

    monkeypatch.setattr(CharacterRepository, "update_visibility", update_visibility)
    with make_test_client() as client:
        response = client.patch("/api/characters/char-1/visibility", json={"is_public": False})
    assert response.status_code == 200
    assert response.json() == {"is_public": False, "shared_id": ""}


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
        accepted = client.patch("/api/characters/char-1/auto-post", json={"enabled": True, "interval_seconds": 21600})
        rejected = client.patch("/api/characters/char-1/auto-post", json={"enabled": True, "interval_seconds": 30})
    assert accepted.status_code == 200
    assert rejected.status_code == 422


def test_generate_character_post_uses_backend_service(monkeypatch: MonkeyPatch) -> None:
    async def generate(self: object, owner_id: object, source_account_id: str, payload: object) -> GenerateApiResult:
        return GenerateApiResult(200, {"post": {"text": "새 글"}})

    monkeypatch.setattr(FeedGenerationService, "generate", generate)
    with make_test_client() as client:
        response = client.post("/api/characters/char-1/posts/generate", json={"idempotency_key": "feed-post:test-key", "mood": "일상"})
    assert response.status_code == 200
    assert response.json()["post"]["text"] == "새 글"


def test_generate_character_post_requires_idempotency_key() -> None:
    with make_test_client() as client:
        response = client.post("/api/characters/char-1/posts/generate", json={"mood": "일상"})
    assert response.status_code == 422


def test_create_public_post_comment_uses_the_authoritative_post(monkeypatch: MonkeyPatch) -> None:
    character_id = uuid4()

    async def append_public_comment(self: object, user: StubUser, target_id: object, post_id: str, payload: object) -> CharacterPostCommentsResponse:
        assert target_id == character_id
        assert post_id == "post-1"
        assert payload.commenter_account_id == "char-1"
        return CharacterPostCommentsResponse(comments=[{"name": "세인", "text": "좋은 밤"}])

    monkeypatch.setattr(CharacterPostsRepository, "append_public_comment", append_public_comment)
    body = {"commenter_account_id": "char-1", "name": "세인", "handle": "sein", "reply_to": "리안", "text": "좋은 밤"}
    with make_test_client() as client:
        response = client.post(f"/api/characters/public/{character_id}/posts/post-1/comments", json=body)
    assert response.status_code == 200
    assert response.json()["comments"][0]["text"] == "좋은 밤"


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


def character_response(source_account_id: str, handle: str) -> CharacterWriteResponse:
    return CharacterWriteResponse(source_account_id=source_account_id, name="Hero", handle=handle, character={"handle": handle}, is_public=True)
