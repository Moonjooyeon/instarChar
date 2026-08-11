from __future__ import annotations

import asyncio
from dataclasses import dataclass
from uuid import uuid4

import pytest

from app.core.errors import ConflictError
from app.models import Character, SharedCharacter
from app.repositories.character_posts import CharacterPostsRepository
from app.schemas.character_posts import CharacterPostCommentCreate, CharacterPostsUpdate


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
        self.added: list[object] = []
        self.statements: list[object] = []
        self.commits = 0

    def add(self, row: object) -> None:
        self.added.append(row)

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


def test_save_posts_creates_a_public_snapshot_without_manual_sharing() -> None:
    owner_id = uuid4()
    character = character_row(owner_id)
    session = StubSession([character, None])
    asyncio.run(CharacterPostsRepository(session).save(StubUser(owner_id), "char-1", CharacterPostsUpdate(posts=[{"text": "새 글"}], revision=2)))
    shared = session.added[0]
    assert isinstance(shared, SharedCharacter)
    assert shared.character["posts"] == [{"text": "새 글"}]


def test_save_posts_keeps_private_character_out_of_discover() -> None:
    owner_id = uuid4()
    character = character_row(owner_id)
    character.is_public = False
    session = StubSession([character])
    asyncio.run(CharacterPostsRepository(session).save(StubUser(owner_id), "char-1", CharacterPostsUpdate(posts=[{"text": "비공개 글"}], revision=2)))
    assert session.added == []


def test_save_posts_rejects_stale_revision() -> None:
    owner_id = uuid4()
    session = StubSession([character_row(owner_id)])
    with pytest.raises(ConflictError):
        asyncio.run(CharacterPostsRepository(session).save(StubUser(owner_id), "char-1", CharacterPostsUpdate(posts=[], revision=1)))
    assert session.commits == 0


def test_post_update_rejects_excessive_or_oversized_ids() -> None:
    with pytest.raises(ValueError):
        CharacterPostsUpdate(posts=[{"text": "글"}] * 41, revision=1)
    with pytest.raises(ValueError):
        CharacterPostsUpdate(posts=[{"id": "x" * 121, "text": "글"}], revision=1)


def test_owned_character_query_is_owner_scoped() -> None:
    owner_id = uuid4()
    session = StubSession([character_row(owner_id)])
    asyncio.run(CharacterPostsRepository(session).owned_character(owner_id, "char-1"))
    sql = str(session.statements[0])
    assert "characters.owner_id" in sql
    assert "characters.source_account_id" in sql


def test_append_public_comment_updates_the_authoritative_post() -> None:
    owner_id = uuid4()
    target_owner_id = uuid4()
    commenter = character_row(owner_id)
    target = Character(id=uuid4(), owner_id=target_owner_id, source_account_id="char-2", name="리안", character={}, posts=[{"id": "post-1", "text": "밤이 깊다"}], posts_revision=4, auto_post_enabled=False, auto_post_interval_seconds=900, last_auto_post_error="", auto_post_failure_count=0)
    shared = SharedCharacter(owner_id=target_owner_id, source_account_id="char-2", name="리안", character={})
    session = StubSession([commenter, target, uuid4(), shared])
    payload = CharacterPostCommentCreate(commenter_account_id="char-1", name="세인", handle="sein", reply_to="리안", text="조심해서 들어가.")
    response = asyncio.run(CharacterPostsRepository(session).append_public_comment(StubUser(owner_id), target.id, "post-1", payload))
    assert response.comments == [{"byUser": True, "handle": "sein", "name": "세인", "replyTo": "리안", "text": "조심해서 들어가."}]
    assert target.posts_revision == 5
    assert shared.character["posts"] == target.posts


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
