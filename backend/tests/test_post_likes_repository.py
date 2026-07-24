from __future__ import annotations

import asyncio
from dataclasses import dataclass
from uuid import UUID, uuid4

import pytest
from sqlalchemy import ForeignKeyConstraint, UniqueConstraint

from app.core.errors import ForbiddenError
from app.models import CharacterPostLike, SharedCharacter
from app.repositories.post_likes import PostLikesRepository
from app.schemas.post_likes import PostLikeTarget, PostLikeUpdate, PostLikesQuery


@dataclass
class StubUser:
    id: UUID


class StubScalars:
    def __init__(self, rows: list[object]) -> None:
        self.rows = rows

    def all(self) -> list[object]:
        return self.rows


class StubResult:
    def __init__(self, scalar: object = None, rows: list[object] | None = None) -> None:
        self.scalar = scalar
        self.rows = rows or []

    def scalar_one_or_none(self) -> object:
        return self.scalar

    def scalar_one(self) -> object:
        return self.scalar

    def scalars(self) -> StubScalars:
        return StubScalars(self.rows)

    def all(self) -> list[object]:
        return self.rows


class StubSession:
    def __init__(self, results: list[StubResult]) -> None:
        self.results = results
        self.statements: list[object] = []
        self.commits = 0

    async def execute(self, statement: object) -> StubResult:
        self.statements.append(statement)
        return self.results.pop(0)

    async def commit(self) -> None:
        self.commits += 1


def test_model_prevents_duplicate_character_post_likes() -> None:
    constraints = CharacterPostLike.__table__.constraints
    names = {item.name for item in constraints if isinstance(item, UniqueConstraint)}
    foreign_keys = [item for item in constraints if isinstance(item, ForeignKeyConstraint)]
    assert "uq_character_post_likes" in names
    assert any(item.ondelete == "CASCADE" for item in foreign_keys)
    assert "ix_character_post_likes_target" in {item.name for item in CharacterPostLike.__table__.indexes}


def test_query_returns_available_and_missing_posts() -> None:
    owner_id = uuid4()
    shared_id = uuid4()
    shared = shared_row(shared_id)
    results = [StubResult(scalar=uuid4()), StubResult(rows=[shared]), StubResult(rows=[(shared_id, "post-1", 2)]), StubResult(rows=[(shared_id, "post-1")])]
    payload = PostLikesQuery(liker_account_id="char-1", targets=[target(shared_id, "post-1"), target(shared_id, "missing")])
    response = asyncio.run(PostLikesRepository(StubSession(results)).query(StubUser(owner_id), payload))
    assert response.items[0].model_dump() == {"target_shared_character_id": shared_id, "post_id": "post-1", "available": True, "liked": True, "likes": 5}
    assert response.items[1].available is False
    assert response.items[1].likes == 0


def test_update_like_is_idempotent_and_returns_canonical_count() -> None:
    owner_id = uuid4()
    shared_id = uuid4()
    session = StubSession([StubResult(scalar=uuid4()), StubResult(scalar=shared_row(shared_id)), StubResult(scalar=uuid4()), StubResult(), StubResult(scalar=1)])
    payload = PostLikeUpdate(liker_account_id="char-1", target_shared_character_id=shared_id, post_id="post-1", liked=True)
    response = asyncio.run(PostLikesRepository(session).update(StubUser(owner_id), payload))
    assert response.liked is True
    assert response.likes == 4
    assert "ON CONFLICT ON CONSTRAINT uq_character_post_likes DO NOTHING" in str(session.statements[3])
    assert session.commits == 1


def test_update_rejects_unowned_liker_character() -> None:
    payload = PostLikeUpdate(liker_account_id="other", target_shared_character_id=uuid4(), post_id="post-1", liked=True)
    with pytest.raises(ForbiddenError):
        asyncio.run(PostLikesRepository(StubSession([StubResult()])).update(StubUser(uuid4()), payload))


def shared_row(shared_id: UUID) -> SharedCharacter:
    return SharedCharacter(id=shared_id, owner_id=uuid4(), source_account_id="target", name="세라", character={"posts": [{"id": "post-1", "likes": 3}]})


def target(shared_id: UUID, post_id: str) -> PostLikeTarget:
    return PostLikeTarget(target_shared_character_id=shared_id, post_id=post_id)
