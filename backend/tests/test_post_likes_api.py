from collections.abc import AsyncIterator
from dataclasses import dataclass
from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.db.session import get_db_session
from app.main import app
from app.models import UserProvider
from app.repositories.post_likes import PostLikesRepository
from app.schemas.post_likes import PostLikeItem, PostLikesResponse


@dataclass
class StubProfile:
    display_name: str = "테스터"
    onboarded: bool = True


@dataclass
class StubUser:
    id: UUID
    email: str
    provider: UserProvider
    profile: StubProfile


class StubSession:
    pass


async def stub_db_session() -> AsyncIterator[StubSession]:
    yield StubSession()


async def stub_current_user() -> StubUser:
    return StubUser(id=uuid4(), email="tester@example.com", provider=UserProvider.google, profile=StubProfile())


def test_query_post_likes_returns_batch_state(monkeypatch) -> None:
    character_id = uuid4()

    async def query(self: object, user: StubUser, payload: object) -> PostLikesResponse:
        item = PostLikeItem(target_character_id=character_id, post_id="post-1", available=True, liked=True, likes=3)
        return PostLikesResponse(items=[item])

    monkeypatch.setattr(PostLikesRepository, "query", query)
    body = {"liker_account_id": "char-1", "targets": [{"target_character_id": str(character_id), "post_id": "post-1"}]}
    with make_test_client() as client:
        response = client.post("/api/post-likes/query", json=body)
    assert response.status_code == 200
    assert response.json()["items"][0]["liked"] is True


def test_update_post_like_returns_canonical_state(monkeypatch) -> None:
    character_id = uuid4()

    async def update(self: object, user: StubUser, payload: object) -> PostLikeItem:
        assert payload.liker_account_id == "char-1"
        return PostLikeItem(target_character_id=character_id, post_id="post-1", available=True, liked=payload.liked, likes=4)

    monkeypatch.setattr(PostLikesRepository, "update", update)
    body = {"liker_account_id": "char-1", "target_character_id": str(character_id), "post_id": "post-1", "liked": True}
    with make_test_client() as client:
        response = client.put("/api/post-likes", json=body)
    assert response.status_code == 200
    assert response.json()["likes"] == 4


def test_query_rejects_more_than_one_hundred_targets() -> None:
    target = {"target_character_id": str(uuid4()), "post_id": "post-1"}
    with make_test_client() as client:
        response = client.post("/api/post-likes/query", json={"liker_account_id": "char-1", "targets": [target] * 101})
    assert response.status_code == 422


def make_test_client() -> TestClient:
    app.dependency_overrides[get_db_session] = stub_db_session
    app.dependency_overrides[get_current_user] = stub_current_user
    return TestClient(app)
