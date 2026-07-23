from __future__ import annotations

import asyncio
from dataclasses import dataclass
from uuid import uuid4

import pytest

from app.core.errors import ConflictError
from app.models import Character, SharedCharacter
from app.repositories.character_posts import CharacterPostsRepository
from app.schemas.character_posts import CharacterPostsUpdate


@dataclass
class StubUser:
    id: object


class StubResult:
    def __init__(self, row: object) -> None:
        self.row = row

    def scalar_one_or_none(self) -> object:
        return self.row


class StubSession:
    def __init__(self, rows: list[object]) -> None:
        self.rows = rows
        self.statements: list[object] = []
        self.commits = 0

    async def execute(self, statement: object) -> StubResult:
        self.statements.append(statement)
        return StubResult(self.rows.pop(0))

    async def commit(self) -> None:
        self.commits += 1


def test_save_posts_checks_revision_and_syncs_shared_snapshot() -> None:
    owner_id = uuid4()
    character = character_row(owner_id)
    shared = SharedCharacter(owner_id=owner_id, source_account_id="char-1", name="세인", character={"persona": "차분함"})
    session = StubSession([character, shared])
    response = asyncio.run(CharacterPostsRepository(session).save(StubUser(owner_id), "char-1", CharacterPostsUpdate(posts=[{"text": "새 글"}], revision=2)))
    assert response.revision == 3
    assert shared.character["posts"] == [{"text": "새 글"}]
    assert session.commits == 1


def test_save_posts_rejects_stale_revision() -> None:
    owner_id = uuid4()
    session = StubSession([character_row(owner_id)])
    with pytest.raises(ConflictError):
        asyncio.run(CharacterPostsRepository(session).save(StubUser(owner_id), "char-1", CharacterPostsUpdate(posts=[], revision=1)))
    assert session.commits == 0


def test_owned_character_query_is_owner_scoped() -> None:
    owner_id = uuid4()
    session = StubSession([character_row(owner_id)])
    asyncio.run(CharacterPostsRepository(session).owned_character(owner_id, "char-1"))
    sql = str(session.statements[0])
    assert "characters.owner_id" in sql
    assert "characters.source_account_id" in sql


def character_row(owner_id: object) -> Character:
    return Character(
        owner_id=owner_id,
        source_account_id="char-1",
        name="세인",
        character={},
        posts=[{"text": "기존 글"}],
        posts_revision=2,
        auto_post_enabled=False,
        auto_post_interval_seconds=900,
        last_auto_post_error="",
        auto_post_failure_count=0,
    )
