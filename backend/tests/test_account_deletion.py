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
from app.core.errors import ConflictError, ServiceUnavailableError
from app.core.token_encryption import TokenCipher
from app.models import User, UserAccountStatus, UserProvider
from app.repositories.users import UserRepository
from app.services.account_deletion import AccountDeletionService
from app.services.apple_token_revocation import AppleTokenRevoker


@dataclass
class StubUser:
    id: UUID
    provider: UserProvider
    provider_subject: str = "subject"


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


class StubPurchases:
    def __init__(self, events: list[str]) -> None:
        self.events = events

    async def retain_subject_link_for_deletion(self, user_id: UUID, now: datetime) -> None:
        self.events.append("retain-purchase")

    async def delete_expired_detached_purchases(self, now: datetime) -> int:
        self.events.append("clear-purchase")
        return 2


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
    assert user.session_version == 1
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
        claimed = False
        async def claim_due_deletion(self, now: datetime, excluded_user_ids: set[UUID]) -> User | None:
            if self.claimed or user.id in excluded_user_ids:
                return None
            self.claimed = True
            return user
        async def delete_account(self, target: User) -> None:
            events.append("delete")
    class StubRevoker:
        async def revoke_all(self, user_id: UUID) -> int:
            events.append("revoke")
            return 1
    service.revoker = StubRevoker()
    service.users = StubUsers()
    service.purchases = StubPurchases(events)
    async def delete_media(target: User) -> None:
        events.append("media")
    monkeypatch.setattr(service, "_delete_media", delete_media)
    asyncio.run(service.purge_due_accounts(20, datetime.now(timezone.utc)))
    assert events == ["media", "revoke", "retain-purchase", "delete"]
    assert session.events == ["commit"]


def test_google_account_does_not_revoke_during_purge() -> None:
    events: list[str] = []
    session = StubSession()
    service = AccountDeletionService(Settings(), cast(AsyncSession, session))
    user = cast(User, StubUser(uuid4(), UserProvider.google))
    class StubUsers:
        claimed = False
        async def claim_due_deletion(self, now: datetime, excluded_user_ids: set[UUID]) -> User | None:
            if self.claimed or user.id in excluded_user_ids:
                return None
            self.claimed = True
            return user
        async def delete_account(self, target: User) -> None:
            events.append("delete")
    service.users = StubUsers()
    service.purchases = StubPurchases(events)
    async def delete_media(target: User) -> None:
        events.append("media")
    service._delete_media = delete_media
    asyncio.run(service.purge_due_accounts(20))
    assert events == ["media", "retain-purchase", "delete"]


def test_toss_account_purge_disconnects_provider_before_deletion(monkeypatch: MonkeyPatch) -> None:
    events: list[str] = []
    session = StubSession()
    service = AccountDeletionService(Settings(), cast(AsyncSession, session))
    user = cast(User, StubUser(uuid4(), UserProvider.toss, "123"))
    class StubUsers:
        claimed = False
        async def claim_due_deletion(self, now: datetime, excluded_user_ids: set[UUID]) -> User | None:
            if self.claimed:
                return None
            self.claimed = True
            return user
        async def delete_account(self, target: User) -> None:
            events.append("delete")
    class StubToss:
        async def disconnect(self, subject: str) -> None:
            events.append(f"disconnect:{subject}")
    service.users = StubUsers()
    service.toss = StubToss()
    service.purchases = StubPurchases(events)
    async def delete_media(target: User) -> None:
        events.append("media")
    monkeypatch.setattr(service, "_delete_media", delete_media)
    asyncio.run(service.purge_due_accounts(20, datetime.now(timezone.utc)))
    assert events == ["media", "disconnect:123", "retain-purchase", "delete"]


def test_account_deletion_purges_expired_detached_purchases() -> None:
    events: list[str] = []
    session = StubSession()
    service = AccountDeletionService(Settings(), cast(AsyncSession, session))
    service.purchases = StubPurchases(events)
    cleared = asyncio.run(service.purge_expired_detached_purchases(datetime.now(timezone.utc)))
    assert (cleared, events, session.events) == (2, ["clear-purchase"], ["commit"])


def test_account_deletion_preserves_shared_dm_for_other_participants() -> None:
    deleted_user_id = uuid4()
    remaining_user_id = uuid4()
    shared_thread = SimpleNamespace(participant_user_ids=[deleted_user_id, remaining_user_id], participant_labels=["탈퇴 사용자", "남은 사용자"])
    solo_thread = SimpleNamespace(participant_user_ids=[deleted_user_id], participant_labels=["탈퇴 사용자"])
    session = SharedThreadSession([shared_thread, solo_thread])
    asyncio.run(UserRepository(cast(AsyncSession, session))._remove_user_from_shared_threads(deleted_user_id))
    assert shared_thread.participant_user_ids == [remaining_user_id]
    assert shared_thread.participant_labels == ["남은 사용자"]
    assert session.deleted == [solo_thread]


def test_revoker_decrypts_stored_refresh_token(monkeypatch: MonkeyPatch) -> None:
    key = Fernet.generate_key().decode()
    settings = Settings(apple_native_client_secret="secret", apple_team_id="", apple_key_id="", apple_private_key="", oauth_token_encryption_key=key)
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
    settings = Settings(apple_native_client_secret="secret", apple_team_id="", apple_key_id="", apple_private_key="")
    revoker = AppleTokenRevoker(settings, cast(object, StubCredentials([])))
    async def post(payload: dict[str, str]) -> httpx.Response:
        return httpx.Response(503)
    monkeypatch.setattr(revoker, "_post", post)
    with raises(ServiceUnavailableError, match="Apple token revocation failed"):
        asyncio.run(revoker._revoke(settings.apple_native_client_id, "refresh-token"))


def test_revoker_accepts_already_invalid_token(monkeypatch: MonkeyPatch) -> None:
    settings = Settings(apple_native_client_secret="secret", apple_team_id="", apple_key_id="", apple_private_key="")
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


def test_account_deletion_is_idempotent() -> None:
    now = datetime(2026, 8, 9, tzinfo=timezone.utc)
    user = cast(User, StubUser(uuid4(), UserProvider.google))
    session = StubSession()
    service = AccountDeletionService(Settings(), cast(AsyncSession, session))
    class StubIdentities:
        async def upsert(self, user: User, fingerprint: str, retention_until: datetime) -> None:
            return None
    service.identities = StubIdentities()
    first = asyncio.run(service.delete(user, now))
    second = asyncio.run(service.delete(user, now + timedelta(days=1)))
    assert first == second
    assert session.events == ["commit"]


def test_provider_recreation_is_blocked_by_retained_identity(monkeypatch: MonkeyPatch) -> None:
    class StubResult:
        def scalar_one_or_none(self) -> None:
            return None
    class StubUserSession:
        async def execute(self, statement: object) -> StubResult:
            return StubResult()
        async def flush(self) -> None:
            return None
    async def blocked(self: object, provider: UserProvider, fingerprint: str, now: datetime) -> bool:
        return True
    monkeypatch.setattr("app.repositories.account_deletion.AccountDeletionIdentityRepository.is_blocked", blocked)
    repository = UserRepository(cast(AsyncSession, StubUserSession()))
    with raises(ConflictError, match="retention period"):
        asyncio.run(repository.get_or_create_provider_user("test@example.com", UserProvider.google, "subject", "Test", "fingerprint"))
