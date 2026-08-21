from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from pytest import MonkeyPatch
from sqlalchemy.dialects import postgresql

from app.core.config import Settings
from app.models import Character, User
from app.models.entities import default_next_auto_post_at
from app.repositories.character_posts import CharacterPostsRepository, complete_auto_post_schedule, next_auto_post_schedule
from app.repositories.auto_posts import AUTO_POST_CLAIM_LEASE, AutoPostRepository, ClaimedAutoPost
from app.schemas.character_posts import AutoPostUpdate
from app.services.auto_post_scheduler import AutoPostScheduler, auto_post_request_key
from app.services.feed_generation import retry_delay_seconds


class StubResult:
    def __init__(self, rows: list[Character]) -> None:
        self.rows = rows

    def scalar_one_or_none(self) -> Character | None:
        return self.rows[0] if self.rows else None


class StubSession:
    def __init__(self, rows: list[Character]) -> None:
        self.rows = rows
        self.commits = 0
        self.rollbacks = 0

    async def execute(self, statement: object) -> StubResult:
        return StubResult(self.rows)

    async def commit(self) -> None:
        self.commits += 1

    async def rollback(self) -> None:
        self.rollbacks += 1


def test_due_statement_uses_skip_locked() -> None:
    now = datetime.now(timezone.utc)
    statement = AutoPostRepository(StubSession([])).due_statement(now)
    sql = str(statement.compile(dialect=postgresql.dialect()))
    assert "FOR UPDATE SKIP LOCKED" in sql
    assert "LIMIT" in sql
    assert "auto_post_enabled" in sql
    assert "auto_post_claimed_at <=" in sql


def test_claim_next_leases_without_advancing_the_schedule() -> None:
    now = datetime.now(timezone.utc)
    row = Character(owner_id=uuid4(), source_account_id="char-1", auto_post_interval_seconds=21600, next_auto_post_at=now, auto_post_failure_count=0)
    session = StubSession([row])
    claim = asyncio.run(AutoPostRepository(session).claim_next(now))
    assert claim == ClaimedAutoPost(row.owner_id, "char-1", now, now, 0)
    assert row.next_auto_post_at == now
    assert row.auto_post_claimed_at == now
    assert session.commits == 1


def test_claim_next_reclaims_a_stale_lease() -> None:
    now = datetime.now(timezone.utc)
    scheduled = now - timedelta(minutes=20)
    stale_claim = now - AUTO_POST_CLAIM_LEASE - timedelta(seconds=1)
    row = Character(owner_id=uuid4(), source_account_id="char-1", next_auto_post_at=scheduled, auto_post_claimed_at=stale_claim, auto_post_failure_count=0)
    asyncio.run(AutoPostRepository(StubSession([row])).claim_next(now))
    assert row.next_auto_post_at == scheduled
    assert row.auto_post_claimed_at == now


def test_two_successful_cycles_schedule_from_each_completion() -> None:
    first = datetime(2026, 8, 20, 3, tzinfo=timezone.utc)
    row = Character(owner_id=uuid4(), source_account_id="char-1", auto_post_enabled=True, auto_post_interval_seconds=3600, next_auto_post_at=first, auto_post_claimed_at=first, auto_post_legacy_credit_stop_recovered=True)
    complete_auto_post_schedule(row, first)
    second = first + timedelta(hours=1)
    assert (row.next_auto_post_at, row.auto_post_claimed_at) == (second, None)
    row.auto_post_claimed_at = second
    complete_auto_post_schedule(row, second)
    assert (row.last_auto_post_at, row.next_auto_post_at) == (second, second + timedelta(hours=1))
    assert row.auto_post_legacy_credit_stop_recovered is True


def test_interval_change_keeps_the_already_scheduled_next_post() -> None:
    now = datetime(2026, 8, 12, 3, tzinfo=timezone.utc)
    scheduled = now + timedelta(minutes=50)
    assert next_auto_post_schedule(True, 3600, True, scheduled, now) == scheduled
    assert next_auto_post_schedule(True, 43200, True, scheduled, now) == scheduled
    assert next_auto_post_schedule(True, 3600, True, now + timedelta(hours=5), now) == now + timedelta(hours=1)


def test_interval_change_resets_an_overdue_schedule_from_now() -> None:
    now = datetime(2026, 8, 12, 3, tzinfo=timezone.utc)
    scheduled = now - timedelta(minutes=1)
    assert next_auto_post_schedule(True, 3600, True, scheduled, now) == now + timedelta(hours=1)
    assert next_auto_post_schedule(False, 3600, True, scheduled, now) is None


def test_scheduler_claims_each_post_immediately_before_generation(monkeypatch: MonkeyPatch) -> None:
    scheduler = AutoPostScheduler(Settings(auto_post_batch_size=2), object())
    now = datetime.now(timezone.utc)
    claims = [ClaimedAutoPost(uuid4(), "a", now, now, 0), ClaimedAutoPost(uuid4(), "b", now, now, 0)]
    events: list[str] = []
    async def claim_next() -> ClaimedAutoPost | None:
        claim = claims.pop(0)
        events.append(f"claim:{claim.source_account_id}")
        return claim
    async def generate(claim: ClaimedAutoPost) -> None:
        events.append(f"generate:{claim.source_account_id}")
    monkeypatch.setattr(scheduler, "_claim_next", claim_next)
    monkeypatch.setattr(scheduler, "_generate", generate)
    asyncio.run(scheduler.poll_once())
    assert events == ["claim:a", "generate:a", "claim:b", "generate:b"]


def test_scheduler_isolates_one_claim_exception(monkeypatch: MonkeyPatch) -> None:
    scheduler = AutoPostScheduler(Settings(auto_post_batch_size=2), object())
    now = datetime.now(timezone.utc)
    claims = [ClaimedAutoPost(uuid4(), "a", now, now, 0), ClaimedAutoPost(uuid4(), "b", now, now, 0)]
    processed: list[str] = []
    released: list[str] = []
    async def claim_next() -> ClaimedAutoPost | None:
        return claims.pop(0)
    async def generate(claim: ClaimedAutoPost) -> None:
        processed.append(claim.source_account_id)
        if claim.source_account_id == "a":
            raise RuntimeError("provider unavailable")
    async def release(claim: ClaimedAutoPost, message: str) -> None:
        assert message == "SCHEDULER_UNHANDLED: RuntimeError"
        released.append(claim.source_account_id)
    monkeypatch.setattr(scheduler, "_claim_next", claim_next)
    monkeypatch.setattr(scheduler, "_generate", generate)
    monkeypatch.setattr(scheduler, "_release_claim_safely", release)
    asyncio.run(scheduler.poll_once())
    assert processed == ["a", "b"]
    assert released == ["a"]


def test_scheduler_releases_claim_before_rethrowing_cancellation(monkeypatch: MonkeyPatch) -> None:
    scheduler = AutoPostScheduler(Settings(), object())
    now = datetime.now(timezone.utc)
    claim = ClaimedAutoPost(uuid4(), "a", now, now, 0)
    started = asyncio.Event()
    released: list[str] = []
    async def generate(_: ClaimedAutoPost) -> None:
        started.set()
        await asyncio.Event().wait()
    async def release(_: ClaimedAutoPost, message: str) -> None:
        await asyncio.sleep(0)
        released.append(message)
    async def cancel_during_generation() -> None:
        task = asyncio.create_task(scheduler._process_claim(claim))
        await started.wait()
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
    monkeypatch.setattr(scheduler, "_generate", generate)
    monkeypatch.setattr(scheduler, "_release_claim_safely", release)
    asyncio.run(cancel_during_generation())
    assert released == ["SCHEDULER_CANCELLED"]


def test_balance_exhaustion_stops_and_releases_the_claim() -> None:
    claimed_at = datetime.now(timezone.utc)
    row = Character(owner_id=uuid4(), source_account_id="char-1", auto_post_enabled=True, next_auto_post_at=claimed_at, auto_post_claimed_at=claimed_at, auto_post_failure_count=0)
    session = StubSession([row])
    asyncio.run(CharacterPostsRepository(session).stop_auto_post_for_balance(row.owner_id, row.source_account_id, claimed_at))
    assert (row.auto_post_enabled, row.next_auto_post_at, row.auto_post_claimed_at) == (False, None, None)
    assert row.last_auto_post_error == "AUTO_POST_BALANCE_EXHAUSTED"
    assert session.commits == 1


def test_auto_failure_releases_the_claim_and_schedules_retry() -> None:
    claimed_at = datetime.now(timezone.utc)
    retry_at = claimed_at + timedelta(minutes=1)
    row = Character(owner_id=uuid4(), source_account_id="char-1", auto_post_enabled=True, next_auto_post_at=claimed_at, auto_post_claimed_at=claimed_at, auto_post_failure_count=0)
    session = StubSession([row])
    repository = CharacterPostsRepository(session)
    asyncio.run(repository.record_auto_failure(row.owner_id, row.source_account_id, "GENERATION_FAILED", retry_at, claimed_at))
    assert (row.next_auto_post_at, row.auto_post_claimed_at) == (retry_at, None)
    assert row.auto_post_enabled is True
    assert row.auto_post_failure_count == 1
    assert session.commits == 1


def test_stale_worker_cannot_replace_a_newer_claim() -> None:
    old_claim = datetime.now(timezone.utc) - timedelta(minutes=16)
    current_claim = datetime.now(timezone.utc)
    retry_at = current_claim + timedelta(minutes=1)
    row = Character(owner_id=uuid4(), source_account_id="char-1", auto_post_enabled=True, next_auto_post_at=current_claim, auto_post_claimed_at=current_claim, auto_post_failure_count=0)
    session = StubSession([row])
    repository = CharacterPostsRepository(session)
    asyncio.run(repository.record_auto_failure(row.owner_id, row.source_account_id, "OLD_WORKER", retry_at, old_claim))
    assert (row.next_auto_post_at, row.auto_post_claimed_at) == (current_claim, current_claim)
    assert (session.commits, session.rollbacks) == (0, 1)


def test_explicit_user_schedule_clears_legacy_recovery_marker() -> None:
    owner_id = uuid4()
    row = Character(owner_id=owner_id, source_account_id="char-1", posts_revision=0, auto_post_enabled=True, next_auto_post_at=datetime.now(timezone.utc), auto_post_legacy_credit_stop_recovered=True)
    session = StubSession([row])
    payload = AutoPostUpdate(enabled=True, interval_seconds=3600)
    asyncio.run(CharacterPostsRepository(session).update_auto_post(User(id=owner_id), row.source_account_id, payload))
    assert row.auto_post_legacy_credit_stop_recovered is False
    assert session.commits == 1


def test_retry_delay_is_exponential_and_capped() -> None:
    assert retry_delay_seconds(0) == 60
    assert retry_delay_seconds(2) == 240
    assert retry_delay_seconds(10) == 900


def test_auto_post_request_key_is_stable_for_a_claim() -> None:
    scheduled = datetime(2026, 8, 9, 3, tzinfo=timezone.utc)
    claim = ClaimedAutoPost(uuid4(), "char-1", scheduled, scheduled, 0)
    assert auto_post_request_key(claim) == "auto-post:char-1:2026-08-09T03:00:00+00:00"


def test_scheduler_settings_enable_background_generation_by_default() -> None:
    settings = Settings(_env_file=None)
    assert settings.auto_post_scheduler_enabled is True
    assert settings.auto_post_poll_seconds == 30
    assert settings.auto_post_batch_size == 10
    assert settings.auto_post_default_interval_seconds == 21600


def test_new_character_auto_post_defaults_are_enabled() -> None:
    now = datetime.now(timezone.utc)
    scheduled = default_next_auto_post_at()
    assert Character.__table__.c.auto_post_enabled.default.arg is True
    assert Character.__table__.c.auto_post_interval_seconds.default.arg == 21600
    assert timedelta(hours=6) <= scheduled - now < timedelta(hours=6, seconds=1)


def test_scheduler_can_be_disabled_for_local_tests(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setenv("AUTO_POST_SCHEDULER_ENABLED", "false")
    assert Settings(_env_file=None).auto_post_scheduler_enabled is False
