import asyncio
from dataclasses import dataclass
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
from app.models import User, UserProvider
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


def test_apple_account_revokes_before_local_deletion() -> None:
    events: list[str] = []
    service = AccountDeletionService(Settings(), cast(AsyncSession, object()))
    class StubRevoker:
        async def revoke_all(self, user_id: UUID) -> int:
            events.append("revoke")
            return 1
    class StubUsers:
        async def delete_account(self, user: User) -> None:
            events.append("delete")
    service.revoker = StubRevoker()
    service.users = StubUsers()
    asyncio.run(service.delete(cast(User, StubUser(uuid4(), UserProvider.apple))))
    assert events == ["revoke", "delete"]


def test_google_account_skips_apple_revocation() -> None:
    events: list[str] = []
    service = AccountDeletionService(Settings(), cast(AsyncSession, object()))
    class StubRevoker:
        async def revoke_all(self, user_id: UUID) -> int:
            events.append("revoke")
            return 1
    class StubUsers:
        async def delete_account(self, user: User) -> None:
            events.append("delete")
    service.revoker = StubRevoker()
    service.users = StubUsers()
    asyncio.run(service.delete(cast(User, StubUser(uuid4(), UserProvider.google))))
    assert events == ["delete"]


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
