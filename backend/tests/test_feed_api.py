import asyncio
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import Integer, column, select
from sqlalchemy.dialects import postgresql

from app.api.deps import get_current_user
from app.db.session import get_db_session
from app.main import app
from app.models import Character, PublicFeedPost, SharedCharacter
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


def test_ranked_feed_cursor_applies_score_before_time() -> None:
    repository = FeedRepository(SimpleNamespace(), cursor_secret="test-secret")
    cursor = (datetime(2026, 8, 10, tzinfo=timezone.utc), "post-1", uuid4(), 7)
    statement = repository._apply_ranked_cursor(select(PublicFeedPost), cursor, column("rank_score", Integer))
    compiled = str(statement.compile(dialect=postgresql.dialect()))
    assert "rank_score <" in compiled
    assert "rank_score =" in compiled
    assert "public_feed_posts.created_at <" in compiled


def test_recommendation_score_supports_normalized_and_legacy_tags() -> None:
    repository = FeedRepository(SimpleNamespace(), cursor_secret="test-secret")
    statement = select(repository._recommendation_score({"마법": 6}).label("score"))
    compiled = str(statement.compile(dialect=postgresql.dialect()))
    assert "shared_characters.tags &&" in compiled
    assert "strpos" in compiled


def test_recommendation_candidates_are_bounded_before_scoring() -> None:
    repository = FeedRepository(SimpleNamespace(), cursor_secret="test-secret")
    compiled = str(repository._recent_recommendation_posts(repository._base_statement()).compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))
    assert "LIMIT 2400" in compiled
    assert "ORDER BY public_feed_posts.created_at DESC" in compiled


def test_recommendation_candidates_apply_exclusions_before_limit() -> None:
    repository = FeedRepository(SimpleNamespace(), cursor_secret="test-secret")
    active = SimpleNamespace(id=uuid4(), source_account_id="char-1")
    statement = repository._recommendation_base(uuid4(), active, {uuid4()})
    compiled = str(repository._recent_recommendation_posts(statement).compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))
    assert "character_follows" in compiled
    assert "shared_characters.owner_id NOT IN" in compiled
    assert compiled.index("shared_characters.owner_id NOT IN") < compiled.index("LIMIT 2400")


def test_feed_candidates_require_active_moderation_status() -> None:
    repository = FeedRepository(SimpleNamespace(), cursor_secret="test-secret")
    compiled = str(repository._base_statement().compile(dialect=postgresql.dialect()))
    assert "users.moderation_status" in compiled


def test_recommendation_page_limits_repeated_authors_and_advances_cursor() -> None:
    repository = FeedRepository(SimpleNamespace(), cursor_secret="test-secret")
    first_id = uuid4()
    rows = [feed_row(first_id, f"post-{index}", 8) for index in range(4)]
    rows.extend([feed_row(uuid4(), "post-4", 7), feed_row(uuid4(), "post-5", 6)])
    page = repository._recommendation_page_from_rows(rows, 3, 6)
    assert [item.author_character_id for item in page.items].count(str(first_id)) == 2
    assert len(page.items) == 3
    assert page.has_more is True
    assert repository._decode_cursor(page.next_cursor, "recommendations")[3] == 7


def test_recommendation_weights_combine_profile_follow_and_like_signals() -> None:
    followed = SharedCharacter(owner_id=uuid4(), source_account_id="followed", name="극장", tags=["마법"], character={"world": "마법 극장"})
    liked = SharedCharacter(owner_id=uuid4(), source_account_id="liked", name="탐정", tags=["추리"], character={"interests": "추리 소설"})
    session = SignalSession([[followed], [liked]])
    active = Character(owner_id=uuid4(), source_account_id="char-1", name="세인", handle="sein", character={"interests": "마법, 홍차"})
    weights = asyncio.run(FeedRepository(session, cursor_secret="test-secret")._recommendation_weights(active.owner_id, active, set()))
    assert weights["마법"] == 9
    assert weights["홍차"] == 6
    assert weights["추리"] == 1


def test_behavior_signals_exclude_blocked_owners() -> None:
    session = SignalSession([[]])
    asyncio.run(FeedRepository(session, cursor_secret="test-secret")._followed_signals(uuid4(), "char-1", {uuid4()}))
    compiled = str(session.statements[0].compile(dialect=postgresql.dialect()))
    assert "shared_characters.owner_id NOT IN" in compiled


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


class SignalResult:
    def __init__(self, rows: list[object]) -> None:
        self.rows = rows

    def scalars(self) -> "SignalResult":
        return self

    def all(self) -> list[object]:
        return self.rows


class SignalSession:
    def __init__(self, results: list[list[object]]) -> None:
        self.results = list(results)
        self.statements: list[object] = []

    async def execute(self, statement: object) -> SignalResult:
        self.statements.append(statement)
        return SignalResult(self.results.pop(0))


def feed_row(author_id: object, post_id: str, score: int) -> tuple[object, object, object, int]:
    created_at = datetime(2026, 8, 10, tzinfo=timezone.utc)
    post = SimpleNamespace(created_at=created_at, payload={"id": post_id, "text": post_id}, post_id=post_id)
    character = SimpleNamespace(id=author_id)
    shared = SimpleNamespace(handle="author", id=uuid4(), name="작성자", owner_id=uuid4())
    return post, character, shared, score


def make_test_client() -> TestClient:
    app.dependency_overrides[get_db_session] = stub_db_session
    app.dependency_overrides[get_current_user] = stub_current_user
    return TestClient(app)
