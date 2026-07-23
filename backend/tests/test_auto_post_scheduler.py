from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from uuid import uuid4

from pytest import MonkeyPatch
from sqlalchemy.dialects import postgresql

from app.core.config import Settings
from app.models import Character
from app.repositories.auto_posts import AutoPostRepository, ClaimedAutoPost
from app.services.auto_post_scheduler import AutoPostScheduler
from app.services.feed_generation import retry_delay_seconds


class StubScalars:
    def __init__(self, rows: list[Character]) -> None:
        self.rows = rows

    def all(self) -> list[Character]:
        return self.rows


class StubResult:
    def __init__(self, rows: list[Character]) -> None:
        self.rows = rows

    def scalars(self) -> StubScalars:
        return StubScalars(self.rows)


class StubSession:
    def __init__(self, rows: list[Character]) -> None:
        self.rows = rows
        self.commits = 0

    async def execute(self, statement: object) -> StubResult:
        return StubResult(self.rows)

    async def commit(self) -> None:
        self.commits += 1


def test_due_statement_uses_skip_locked() -> None:
    now = datetime.now(timezone.utc)
    statement = AutoPostRepository(StubSession([])).due_statement(now, 10)
    sql = str(statement.compile(dialect=postgresql.dialect()))
    assert "FOR UPDATE SKIP LOCKED" in sql
    assert "auto_post_enabled" in sql


def test_claim_due_advances_next_run_before_generation() -> None:
    now = datetime.now(timezone.utc)
    row = Character(owner_id=uuid4(), source_account_id="char-1", auto_post_interval_seconds=1800)
    session = StubSession([row])
    claims = asyncio.run(AutoPostRepository(session).claim_due(now, 10))
    assert claims == [ClaimedAutoPost(row.owner_id, "char-1")]
    assert int((row.next_auto_post_at - now).total_seconds()) == 1800
    assert session.commits == 1


def test_scheduler_processes_each_claim(monkeypatch: MonkeyPatch) -> None:
    scheduler = AutoPostScheduler(Settings(), object())
    claims = [ClaimedAutoPost(uuid4(), "a"), ClaimedAutoPost(uuid4(), "b")]
    processed: list[str] = []

    async def claim_due() -> list[ClaimedAutoPost]:
        return claims

    async def generate(claim: ClaimedAutoPost) -> None:
        processed.append(claim.source_account_id)

    monkeypatch.setattr(scheduler, "_claim_due", claim_due)
    monkeypatch.setattr(scheduler, "_generate", generate)
    asyncio.run(scheduler.poll_once())
    assert processed == ["a", "b"]


def test_retry_delay_is_exponential_and_capped() -> None:
    assert retry_delay_seconds(0) == 60
    assert retry_delay_seconds(2) == 240
    assert retry_delay_seconds(10) == 900
