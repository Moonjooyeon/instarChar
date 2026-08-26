import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import cast

from pytest import LogCaptureFixture, MonkeyPatch
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.config import Settings
from app.repositories.native_oauth_codes import NativeOAuthCleanupResult
from app.services.account_deletion_scheduler import AccountDeletionScheduler
from app.services.native_oauth import NativeOAuthService


class StubSession:
    def __init__(self) -> None:
        self.commits = 0

    async def commit(self) -> None:
        self.commits += 1


class StubCodes:
    def __init__(self, result: NativeOAuthCleanupResult) -> None:
        self.result = result
        self.calls: list[tuple[datetime, int]] = []

    async def delete_expired(self, cutoff: datetime, batch_size: int) -> NativeOAuthCleanupResult:
        self.calls.append((cutoff, batch_size))
        return self.result


class StubSessionContext:
    async def __aenter__(self) -> AsyncSession:
        return cast(AsyncSession, StubSession())

    async def __aexit__(self, exc_type: type[BaseException] | None, exc: BaseException | None, traceback: object) -> None:
        return None


class StubSessionFactory:
    def __call__(self) -> StubSessionContext:
        return StubSessionContext()


class StubAccountDeletionService:
    def __init__(self, settings: Settings, session: AsyncSession) -> None:
        return None

    async def purge_due_accounts(self, batch_size: int) -> int:
        return 0

    async def purge_expired_identities(self) -> int:
        return 0

    async def purge_expired_detached_purchases(self) -> int:
        return 0


class StubNativeOAuthCleanup:
    events: list[str] = []

    def __init__(self, settings: Settings, session: AsyncSession) -> None:
        return None

    async def purge_expired(self) -> int:
        self.events.append("native-oauth-cleanup")
        return 1


def test_cleanup_logs_non_identifying_aggregate(caplog: LogCaptureFixture) -> None:
    now = datetime(2026, 8, 26, 6, tzinfo=timezone.utc)
    settings = Settings(native_oauth_code_cleanup_grace_seconds=86400, native_oauth_code_cleanup_batch_size=500)
    session = StubSession()
    result = NativeOAuthCleanupResult(47, 44, 3, now - timedelta(days=30))
    codes = StubCodes(result)
    service = NativeOAuthService(settings, cast(AsyncSession, session))
    service.codes = codes
    with caplog.at_level(logging.INFO, logger="app.services.native_oauth"):
        deleted = asyncio.run(service.purge_expired(now))
    assert deleted == 47
    assert codes.calls == [(now - timedelta(hours=24), 500)]
    assert session.commits == 1
    assert "total=47 used=44 unused=3" in caplog.text
    assert "code_hash" not in caplog.text and "user_id" not in caplog.text


def test_cleanup_preserves_batch_limit() -> None:
    now = datetime(2026, 8, 26, 6, tzinfo=timezone.utc)
    settings = Settings(native_oauth_code_cleanup_batch_size=2)
    session = StubSession()
    codes = StubCodes(NativeOAuthCleanupResult(2, 1, 1, now - timedelta(days=2)))
    service = NativeOAuthService(settings, cast(AsyncSession, session))
    service.codes = codes
    assert asyncio.run(service.purge_expired(now)) == 2
    assert codes.calls[0][1] == 2


def test_cleanup_logs_an_empty_result(caplog: LogCaptureFixture) -> None:
    now = datetime(2026, 8, 26, 6, tzinfo=timezone.utc)
    service = NativeOAuthService(Settings(), cast(AsyncSession, StubSession()))
    service.codes = StubCodes(NativeOAuthCleanupResult(0, 0, 0, None))
    with caplog.at_level(logging.INFO, logger="app.services.native_oauth"):
        assert asyncio.run(service.purge_expired(now)) == 0
    assert "total=0 used=0 unused=0" in caplog.text
    assert "oldest_expired_at=none" in caplog.text


def test_scheduler_runs_enabled_native_oauth_cleanup(monkeypatch: MonkeyPatch) -> None:
    StubNativeOAuthCleanup.events = []
    monkeypatch.setattr("app.services.account_deletion_scheduler.AccountDeletionService", StubAccountDeletionService)
    monkeypatch.setattr("app.services.account_deletion_scheduler.NativeOAuthService", StubNativeOAuthCleanup)
    settings = Settings(native_oauth_code_cleanup_enabled=True)
    factory = cast(async_sessionmaker[AsyncSession], StubSessionFactory())
    assert asyncio.run(AccountDeletionScheduler(settings, factory).poll_once()) == 0
    assert StubNativeOAuthCleanup.events == ["native-oauth-cleanup"]
