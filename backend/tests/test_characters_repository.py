from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID, uuid4

import pytest
from sqlalchemy.exc import IntegrityError

from app.core.errors import CharacterHandleTakenError
from app.models import Character, CharacterFollow, SharedCharacter
from app.repositories.characters import CharacterRepository
from app.schemas.characters import CharacterWrite


class ScalarRows:
    def __init__(self, rows: list[object]) -> None:
        self.rows = rows

    def all(self) -> list[object]:
        return self.rows


class StubResult:
    def __init__(self, row: object = None, rows: list[object] | None = None) -> None:
        self.row = row
        self.rows = rows or []

    def scalar_one(self) -> object:
        return self.row

    def scalar_one_or_none(self) -> object:
        return self.row

    def scalars(self) -> ScalarRows:
        return ScalarRows(self.rows)


class StubSession:
    def __init__(self, results: list[StubResult] | None = None, error: IntegrityError | None = None) -> None:
        self.results = list(results or [])
        self.error = error
        self.committed = False
        self.rolled_back = False

    async def execute(self, statement: object) -> StubResult:
        if self.error:
            raise self.error
        return self.results.pop(0)

    async def commit(self) -> None:
        self.committed = True

    async def rollback(self) -> None:
        self.rolled_back = True


@dataclass
class StubUser:
    id: UUID


@dataclass
class Diagnostic:
    constraint_name: str


class DriverError(Exception):
    def __init__(self, constraint_name: str) -> None:
        self.diag = Diagnostic(constraint_name)


@pytest.mark.anyio
async def test_availability_excludes_only_owned_source() -> None:
    owner_id = uuid4()
    owned = Character(owner_id=owner_id, source_account_id="char-1", name="Hero", handle="hero")
    repository = CharacterRepository(StubSession([StubResult(owned), StubResult(owned)]))  # type: ignore[arg-type]
    available = await repository.availability(StubUser(owner_id), "hero", "char-1")  # type: ignore[arg-type]
    taken = await repository.availability(StubUser(uuid4()), "hero", "char-1")  # type: ignore[arg-type]
    assert available.available is True
    assert taken.available is False


@pytest.mark.anyio
async def test_save_is_idempotent_and_syncs_handle_snapshots() -> None:
    owner_id = uuid4()
    row = Character(owner_id=owner_id, source_account_id="draft-1", name="Hero", handle="hero", character={"handle": "hero"})
    shared = SharedCharacter(owner_id=owner_id, source_account_id="draft-1", name="Hero", handle="old", character={"handle": "old"})
    follower = CharacterFollow(follower_id=owner_id, follower_account_id="draft-1", target_shared_character_id=uuid4(), follower_character={"handle": "old"})
    session = StubSession([StubResult(row), StubResult(shared), StubResult(rows=[follower])])
    repository = CharacterRepository(session)  # type: ignore[arg-type]
    response = await repository.save(StubUser(owner_id), "draft-1", CharacterWrite(name="Hero", handle="Hero"))  # type: ignore[arg-type]
    assert response.handle == "hero"
    assert shared.handle == "hero"
    assert follower.follower_character["handle"] == "hero"
    assert session.committed is True


@pytest.mark.anyio
async def test_named_handle_constraint_rolls_back_as_stable_conflict() -> None:
    error = IntegrityError("statement", {}, DriverError("uq_characters_handle"))
    session = StubSession(error=error)
    repository = CharacterRepository(session)  # type: ignore[arg-type]
    with pytest.raises(CharacterHandleTakenError):
        await repository.save(StubUser(uuid4()), "draft-1", CharacterWrite(name="Hero", handle="hero"))  # type: ignore[arg-type]
    assert session.rolled_back is True


@pytest.mark.anyio
async def test_other_integrity_errors_are_not_misclassified() -> None:
    error = IntegrityError("statement", {}, DriverError("another_constraint"))
    session = StubSession(error=error)
    repository = CharacterRepository(session)  # type: ignore[arg-type]
    with pytest.raises(IntegrityError):
        await repository.save(StubUser(uuid4()), "draft-1", CharacterWrite(name="Hero", handle="hero"))  # type: ignore[arg-type]
