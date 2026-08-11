from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from uuid import uuid4

from pytest import MonkeyPatch
from sqlalchemy.dialects import postgresql

from app.core.config import Settings
from app.models import Character
from app.repositories.auto_posts import AutoPostRepository, ClaimedAutoPost
from app.services.auto_post_scheduler import AutoPostScheduler, auto_post_request_key
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
    row = Character(owner_id=uuid4(), source_account_id="char-1", auto_post_interval_seconds=21600)
    session = StubSession([row])
    claims = asyncio.run(AutoPostRepository(session).claim_due(now, 10))
    assert claims == [ClaimedAutoPost(row.owner_id, "char-1", now)]
    assert int((row.next_auto_post_at - now).total_seconds()) == 21600
    assert session.commits == 1


def test_scheduler_processes_each_claim(monkeypatch: MonkeyPatch) -> None:
    scheduler = AutoPostScheduler(Settings(), object())
    now = datetime.now(timezone.utc)
    claims = [ClaimedAutoPost(uuid4(), "a", now), ClaimedAutoPost(uuid4(), "b", now)]
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


def test_auto_post_request_key_is_stable_for_a_claim() -> None:
    claim = ClaimedAutoPost(uuid4(), "char-1", datetime(2026, 8, 9, 3, tzinfo=timezone.utc))
    assert auto_post_request_key(claim) == "auto-post:char-1:2026-08-09T03:00:00+00:00"


def test_scheduler_settings_enable_background_generation_by_default() -> None:
    settings = Settings(_env_file=None)
    assert settings.auto_post_scheduler_enabled is True
    assert settings.auto_post_poll_seconds == 30
    assert settings.auto_post_batch_size == 10
    assert settings.auto_post_default_interval_seconds == 3600


def test_scheduler_can_be_disabled_for_local_tests(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setenv("AUTO_POST_SCHEDULER_ENABLED", "false")
    assert Settings(_env_file=None).auto_post_scheduler_enabled is False
