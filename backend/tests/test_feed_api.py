import asyncio
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.dialects import postgresql

from app.api.deps import get_current_user
from app.db.session import get_db_session
from app.main import app
from app.models import PublicFeedPost
from app.core.errors import TooManyRequestsError
from app.repositories.feed import FeedRepository
from app.schemas.feed import FeedPage, FeedPageItem


@dataclass
class StubUser:
    id: object


class StubSession:
    def __init__(self) -> None:
        self.commits = 0

    async def execute(self, statement: object) -> object:
        raise AssertionError(statement)

    async def commit(self) -> None:
        self.commits += 1


async def stub_db_session() -> AsyncIterator[StubSession]:
    yield StubSession()


async def stub_current_user() -> StubUser:
    return StubUser(id=uuid4())


def test_feed_page_passes_cursor_contract(monkeypatch) -> None:
    calls: list[tuple[str, str, str, int]] = []
    async def page(self: object, user: StubUser, source_account_id: str, kind: str, cursor: str, limit: int) -> FeedPage:
        calls.append((source_account_id, kind, cursor, limit))
        return FeedPage(items=[FeedPageItem(author_character_id="character-1", author_name="세인", author_owner_id=str(user.id), author_shared_id="shared-1", post_id="post-1", post={"id": "post-1", "text": "안녕"})], has_more=True, next_cursor="next")
    monkeypatch.setattr(FeedRepository, "page", page)
    with make_test_client() as client:
        response = client.get("/api/feed?source_account_id=char-1&kind=timeline&cursor=current&limit=20")
    assert response.status_code == 200
    assert calls == [("char-1", "timeline", "current", 20)]
    assert response.headers["cache-control"] == "private, no-store"
    assert response.json()["items"][0]["post"]["id"] == "post-1"
    assert response.json()["items"][0]["post_id"] == "post-1"


def test_feed_cursor_rejects_other_feed_kind() -> None:
    repository = FeedRepository(SimpleNamespace(), cursor_secret="test-secret")
    author_id = uuid4()
    cursor = repository._cursor_from_row((SimpleNamespace(created_at=SimpleNamespace(isoformat=lambda: "2026-08-10T00:00:00+00:00"), post_id="post-1"), SimpleNamespace(id=author_id), None), "timeline")
    decoded = repository._decode_cursor(cursor, "timeline")
    assert decoded is not None
    assert decoded[1:] == ("post-1", author_id, 0)
    try:
        repository._decode_cursor(cursor, "recommendations")
    except Exception as error:
        assert error.code == "BAD_REQUEST"
    else:
        raise AssertionError("Expected invalid cursor")


def test_feed_cursor_rejects_tampering() -> None:
    repository = FeedRepository(SimpleNamespace(), cursor_secret="test-secret")
    cursor = repository._cursor_from_row((SimpleNamespace(created_at=SimpleNamespace(isoformat=lambda: "2026-08-10T00:00:00+00:00"), post_id="post-1"), SimpleNamespace(id=uuid4()), None), "timeline")
    encoded, signature = cursor.split(".")
    replacement = "A" if encoded[0] != "A" else "B"
    try:
        repository._decode_cursor(f"{replacement}{encoded[1:]}.{signature}", "timeline")
    except Exception as error:
        assert error.code == "BAD_REQUEST"
    else:
        raise AssertionError("Expected invalid cursor")


def test_feed_cursor_uses_author_as_tie_breaker() -> None:
    repository = FeedRepository(SimpleNamespace(), cursor_secret="test-secret")
    statement = repository._apply_cursor(select(PublicFeedPost), (datetime(2026, 8, 10, tzinfo=timezone.utc), "post-1", uuid4(), 0))
    compiled = str(statement.compile(dialect=postgresql.dialect()))
    assert "public_feed_posts.author_character_id <" in compiled


def test_feed_rate_limit_rejects_excess_requests() -> None:
    repository = FeedRepository(RateLimitSession(61), cursor_secret="test-secret")
    try:
        asyncio.run(repository._consume_rate_limit(uuid4()))
    except TooManyRequestsError as error:
        assert error.status_code == 429
    else:
        raise AssertionError("Expected feed rate limit")


class RateLimitResult:
    def __init__(self, count: int) -> None:
        self.count = count

    def scalar_one(self) -> int:
        return self.count


class RateLimitSession:
    def __init__(self, count: int) -> None:
        self.count = count
        self.statement: object | None = None

    async def execute(self, statement: object) -> RateLimitResult:
        self.statement = statement
        return RateLimitResult(self.count)


def make_test_client() -> TestClient:
    app.dependency_overrides[get_db_session] = stub_db_session
    app.dependency_overrides[get_current_user] = stub_current_user
    return TestClient(app)
