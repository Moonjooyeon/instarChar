import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import cast
from uuid import UUID, uuid4

import httpx
from cryptography.fernet import Fernet
from pytest import MonkeyPatch, raises
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import ServiceUnavailableError
from app.core.token_encryption import TokenCipher
from app.models import User, UserAccountStatus, UserProvider
from app.repositories.users import UserRepository
from app.services.account_deletion import AccountDeletionService
from app.services.apple_token_revocation import AppleTokenRevoker


@dataclass
class StubUser:
    id: UUID
    provider: UserProvider


class StubCredentials:
    def __init__(self, rows: list[object]) -> None:
        self.rows = rows

    async def list_for_user(self, user_id: UUID) -> list[object]:
        return self.rows


class StubSession:
    def __init__(self) -> None:
        self.events: list[str] = []

    async def commit(self) -> None:
        self.events.append("commit")


class SharedThreadSession:
    def __init__(self, rows: list[object]) -> None:
        self.rows = rows
        self.deleted: list[object] = []

    async def delete(self, row: object) -> None:
        self.deleted.append(row)

    async def execute(self, statement: object) -> object:
        return SimpleNamespace(scalars=lambda: self.rows)


def test_account_deletion_schedules_pending_state_without_revoking_provider() -> None:
    now = datetime(2026, 8, 9, tzinfo=timezone.utc)
    events: list[str] = []
    session = StubSession()
    service = AccountDeletionService(Settings(), cast(AsyncSession, session))
    class StubIdentities:
        async def upsert(self, user: User, fingerprint: str, retention_until: datetime) -> None:
            events.append(f"identity:{fingerprint[:8]}")
    user = cast(User, StubUser(uuid4(), UserProvider.apple))
    service.identities = StubIdentities()
    purge_at = asyncio.run(service.delete(user, now))
    assert purge_at == now + timedelta(days=7)
    assert user.account_status == UserAccountStatus.pending_deletion
    assert user.deletion_requested_at == now
    assert user.purge_at == purge_at
    assert events[0].startswith("identity:")
    assert session.events == ["commit"]


def test_due_account_purge_revokes_then_deletes(monkeypatch: MonkeyPatch) -> None:
    events: list[str] = []
    session = StubSession()
    service = AccountDeletionService(Settings(), cast(AsyncSession, session))
    user = cast(User, StubUser(uuid4(), UserProvider.apple))
    class StubUsers:
        async def list_due_deletions(self, now: datetime, limit: int) -> list[User]:
            return [user]
        async def delete_account(self, target: User) -> None:
            events.append("delete")
    class StubRevoker:
        async def revoke_all(self, user_id: UUID) -> int:
            events.append("revoke")
            return 1
    service.revoker = StubRevoker()
    service.users = StubUsers()
    async def delete_media(target: User) -> None:
        events.append("media")
    monkeypatch.setattr(service, "_delete_media", delete_media)
    asyncio.run(service.purge_due_accounts(20, datetime.now(timezone.utc)))
    assert events == ["media", "revoke", "delete"]
    assert session.events == ["commit"]


def test_google_account_does_not_revoke_during_purge() -> None:
    events: list[str] = []
    session = StubSession()
    service = AccountDeletionService(Settings(), cast(AsyncSession, session))
    user = cast(User, StubUser(uuid4(), UserProvider.google))
    class StubUsers:
        async def list_due_deletions(self, now: datetime, limit: int) -> list[User]:
            return [user]
        async def delete_account(self, target: User) -> None:
            events.append("delete")
    service.users = StubUsers()
    async def delete_media(target: User) -> None:
        events.append("media")
    service._delete_media = delete_media
    asyncio.run(service.purge_due_accounts(20))
    assert events == ["media", "delete"]


def test_account_deletion_preserves_shared_dm_for_other_participants() -> None:
    deleted_user_id = uuid4()
    remaining_user_id = uuid4()
    shared_thread = SimpleNamespace(participant_user_ids=[deleted_user_id, remaining_user_id])
    solo_thread = SimpleNamespace(participant_user_ids=[deleted_user_id])
    session = SharedThreadSession([shared_thread, solo_thread])
    asyncio.run(UserRepository(cast(AsyncSession, session))._remove_user_from_shared_threads(deleted_user_id))
    assert shared_thread.participant_user_ids == [remaining_user_id]
    assert session.deleted == [solo_thread]


def test_revoker_decrypts_stored_refresh_token(monkeypatch: MonkeyPatch) -> None:
    key = Fernet.generate_key().decode()
    settings = Settings(apple_native_client_secret="secret", oauth_token_encryption_key=key)
    encrypted = TokenCipher(settings).encrypt("refresh-token")
    row = SimpleNamespace(client_id=settings.apple_native_client_id, refresh_token_encrypted=encrypted)
    revoker = AppleTokenRevoker(settings, cast(object, StubCredentials([row])))
    captured: dict[str, str] = {}
    async def post(payload: dict[str, str]) -> httpx.Response:
        captured.update(payload)
        return httpx.Response(200)
    monkeypatch.setattr(revoker, "_post", post)
    asyncio.run(revoker.revoke_all(uuid4()))
    assert captured["token"] == "refresh-token"
    assert captured["token_type_hint"] == "refresh_token"


def test_revoker_preserves_account_on_provider_failure(monkeypatch: MonkeyPatch) -> None:
    settings = Settings(apple_native_client_secret="secret")
    revoker = AppleTokenRevoker(settings, cast(object, StubCredentials([])))
    async def post(payload: dict[str, str]) -> httpx.Response:
        return httpx.Response(503)
    monkeypatch.setattr(revoker, "_post", post)
    with raises(ServiceUnavailableError, match="Apple token revocation failed"):
        asyncio.run(revoker._revoke(settings.apple_native_client_id, "refresh-token"))


def test_revoker_accepts_already_invalid_token(monkeypatch: MonkeyPatch) -> None:
    settings = Settings(apple_native_client_secret="secret")
    revoker = AppleTokenRevoker(settings, cast(object, StubCredentials([])))
    async def post(payload: dict[str, str]) -> httpx.Response:
        return httpx.Response(400, json={"error": "invalid_token"})
    monkeypatch.setattr(revoker, "_post", post)
    asyncio.run(revoker._revoke(settings.apple_native_client_id, "refresh-token"))


def test_identity_fingerprint_is_stable_and_provider_scoped() -> None:
    from app.services.account_deletion import identity_fingerprint
    settings = Settings(auth_secret_key="secret")
    user = StubUser(uuid4(), UserProvider.google)
    other = StubUser(uuid4(), UserProvider.apple)
    first = identity_fingerprint(settings, cast(User, user))
    assert first == identity_fingerprint(settings, cast(User, user))
    assert first != identity_fingerprint(settings, cast(User, other))
