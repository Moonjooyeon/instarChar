from collections.abc import AsyncIterator
from dataclasses import dataclass
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.db.session import get_db_session
from app.main import app
from app.models import UserProvider
from app.repositories.shared_characters import ShareId, SharedCharacterRepository
from app.schemas.shared_characters import DiscoverCharacter, FollowerRow


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


def test_discover_characters_returns_merged_dto(monkeypatch) -> None:
    owner_id = uuid4()

    async def discover(self: object) -> list[DiscoverCharacter]:
        return [DiscoverCharacter(id="shared_1", sharedId=str(uuid4()), ownerId=owner_id, sourceAccountId="char-1", owner="@tester", ownerName="tester", shared=True, name="A")]

    monkeypatch.setattr(SharedCharacterRepository, "discover", discover)
    with make_test_client() as client:
        response = client.get("/api/discover/characters")
    assert response.status_code == 200
    assert response.json()["characters"][0]["sourceAccountId"] == "char-1"


def test_get_character_share_returns_id(monkeypatch) -> None:
    shared_id = uuid4()

    async def get_share_id(self: object, user: StubUser, source_account_id: str) -> ShareId:
        assert source_account_id == "char-1"
        return ShareId(shared_id)

    monkeypatch.setattr(SharedCharacterRepository, "get_share_id", get_share_id)
    with make_test_client() as client:
        response = client.get("/api/characters/char-1/share")
    assert response.status_code == 200
    assert response.json()["id"] == str(shared_id)


def test_get_follower_counts_returns_count_map(monkeypatch) -> None:
    shared_id = uuid4()

    async def follower_counts(self: object, ids: list[object]) -> dict[object, int]:
        return {ids[0]: 3}

    monkeypatch.setattr(SharedCharacterRepository, "follower_counts", follower_counts)
    with make_test_client() as client:
        response = client.get(f"/api/shared-characters/follower-counts?ids={shared_id}")
    assert response.status_code == 200
    assert response.json()["counts"][str(shared_id)] == 3


def test_upsert_shared_character_returns_id(monkeypatch) -> None:
    shared_id = uuid4()

    async def upsert_shared(self: object, user: StubUser, source_account_id: str, payload: object) -> ShareId:
        assert payload.name == "A"
        return ShareId(shared_id)

    monkeypatch.setattr(SharedCharacterRepository, "upsert_shared", upsert_shared)
    body = {"owner_name": "tester", "name": "A", "handle": "", "persona": "", "tags": [], "character": {}}
    with make_test_client() as client:
        response = client.put("/api/shared-characters/by-source/char-1", json=body)
    assert response.status_code == 200
    assert response.json()["id"] == str(shared_id)


def test_follow_shared_character_returns_ok(monkeypatch) -> None:
    shared_id = uuid4()

    async def follow(self: object, user: StubUser, target_id: object, payload: object) -> bool:
        assert target_id == shared_id
        assert payload.follower_account_id == "char-1"
        return True

    monkeypatch.setattr(SharedCharacterRepository, "follow", follow)
    body = {"follower_name": "tester", "follower_account_id": "char-1", "follower_character": {"name": "A"}}
    with make_test_client() as client:
        response = client.put(f"/api/shared-characters/{shared_id}/follow", json=body)
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_unfollow_shared_character_returns_no_content(monkeypatch) -> None:
    calls = []

    async def unfollow(self: object, user: StubUser, shared_id: object, follower_account_id: str) -> None:
        calls.append((shared_id, follower_account_id))

    shared_id = uuid4()
    monkeypatch.setattr(SharedCharacterRepository, "unfollow", unfollow)
    with make_test_client() as client:
        response = client.delete(f"/api/shared-characters/{shared_id}/follow?follower_account_id=char-1")
    assert response.status_code == 204
    assert calls == [(shared_id, "char-1")]


def test_followers_returns_rows(monkeypatch) -> None:
    owner_id = uuid4()
    shared_id = uuid4()

    async def followers(self: object, target_id: object) -> list[FollowerRow]:
        return [FollowerRow(id="follower_1", ownerId=owner_id, sourceAccountId="char-1", owner="@tester", ownerName="tester", followerAccountId="char-1", name="A")]

    monkeypatch.setattr(SharedCharacterRepository, "followers", followers)
    with make_test_client() as client:
        response = client.get(f"/api/shared-characters/{shared_id}/followers")
    assert response.status_code == 200
    assert response.json()["rows"][0]["sourceAccountId"] == "char-1"


def test_sync_owned_follow_snapshot_accepts_rows(monkeypatch) -> None:
    calls = []
    shared_id = uuid4()

    async def sync_owned_follow_snapshots(self: object, user: StubUser, payload: object) -> None:
        calls.append(payload.rows[0].target_shared_character_id)

    monkeypatch.setattr(SharedCharacterRepository, "sync_owned_follow_snapshots", sync_owned_follow_snapshots)
    body = {"rows": [{"target_shared_character_id": str(shared_id), "follower_name": "tester", "follower_account_id": "char-1", "follower_character": {"name": "A"}}]}
    with make_test_client() as client:
        response = client.post("/api/follows/sync-owned-snapshot", json=body)
    assert response.status_code == 204
    assert calls == [shared_id]


def test_relationship_follow_back_returns_ok(monkeypatch) -> None:
    follower_id = uuid4()
    target_id = uuid4()

    async def relationship_follow_back(self: object, user: StubUser, follower: object, target: object) -> bool:
        assert follower == follower_id
        assert target == target_id
        return True

    monkeypatch.setattr(SharedCharacterRepository, "relationship_follow_back", relationship_follow_back)
    with make_test_client() as client:
        response = client.post(f"/api/shared-characters/{target_id}/relationship-follow-back", json={"follower_shared_character_id": str(follower_id)})
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_relationship_follow_back_requires_mutual_love_words() -> None:
    repo = SharedCharacterRepository(StubSession())
    follower = SimpleNamespace(name="A", persona="", character={"relations": "B와 연인"})
    target = SimpleNamespace(name="B", persona="", character={"relations": "A와 친구"})
    assert repo._mutual_love(follower, target) is False
    target.character = {"relations": "A와 애인"}
    assert repo._mutual_love(follower, target) is True


def make_test_client() -> TestClient:
    app.dependency_overrides[get_db_session] = stub_db_session
    app.dependency_overrides[get_current_user] = stub_current_user
    return TestClient(app)
