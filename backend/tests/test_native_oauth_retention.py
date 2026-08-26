import asyncio
from datetime import datetime, timedelta, timezone
from typing import cast

from pytest import MonkeyPatch
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.config import Settings
from app.services.account_deletion_scheduler import AccountDeletionScheduler
from app.services.native_oauth import NativeOAuthService


class StubSession:
    def __init__(self) -> None:
        self.commits = 0

    async def commit(self) -> None:
        self.commits += 1


class StubCodes:
    def __init__(self, deleted: int) -> None:
        self.deleted = deleted
        self.calls: list[tuple[datetime, int]] = []

    async def delete_expired(self, cutoff: datetime, batch_size: int) -> int:
        self.calls.append((cutoff, batch_size))
        return self.deleted


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


def test_cleanup_deletes_only_codes_outside_grace_period() -> None:
    now = datetime(2026, 8, 26, 6, tzinfo=timezone.utc)
    settings = Settings(native_oauth_code_cleanup_grace_seconds=86400, native_oauth_code_cleanup_batch_size=500)
    session = StubSession()
    codes = StubCodes(47)
    service = NativeOAuthService(settings, cast(AsyncSession, session))
    service.codes = codes
    deleted = asyncio.run(service.purge_expired(now))
    assert deleted == 47
    assert codes.calls == [(now - timedelta(hours=24), 500)]
    assert session.commits == 1


def test_cleanup_preserves_batch_limit() -> None:
    now = datetime(2026, 8, 26, 6, tzinfo=timezone.utc)
    settings = Settings(native_oauth_code_cleanup_batch_size=2)
    session = StubSession()
    codes = StubCodes(2)
    service = NativeOAuthService(settings, cast(AsyncSession, session))
    service.codes = codes
    assert asyncio.run(service.purge_expired(now)) == 2
    assert codes.calls[0][1] == 2


def test_scheduler_runs_enabled_native_oauth_cleanup(monkeypatch: MonkeyPatch) -> None:
    StubNativeOAuthCleanup.events = []
    monkeypatch.setattr("app.services.account_deletion_scheduler.AccountDeletionService", StubAccountDeletionService)
    monkeypatch.setattr("app.services.account_deletion_scheduler.NativeOAuthService", StubNativeOAuthCleanup)
    settings = Settings(native_oauth_code_cleanup_enabled=True)
    factory = cast(async_sessionmaker[AsyncSession], StubSessionFactory())
    assert asyncio.run(AccountDeletionScheduler(settings, factory).poll_once()) == 0
    assert StubNativeOAuthCleanup.events == ["native-oauth-cleanup"]
