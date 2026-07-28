from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import cast
from uuid import UUID, uuid4

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from pytest import MonkeyPatch, raises
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import BadRequestError
from app.services.apple_notifications import AppleAccountChange, AppleNotificationService, AppleNotificationVerifier


@dataclass
class StubUser:
    id: UUID
    auth_revoked_at: datetime | None = None


class StubSession:
    def __init__(self) -> None:
        self.commits = 0

    async def commit(self) -> None:
        self.commits += 1


def apple_notification_token(audience: str = "com.ashwoodfriends.alive") -> tuple[str, object]:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    events = {"type": "consent-revoked", "sub": "apple-user", "event_time": 1785207600}
    claims = {"iss": "https://appleid.apple.com", "aud": audience, "iat": 1785207600, "jti": "event-1", "events": events}
    return jwt.encode(claims, private_key, algorithm="RS256", headers={"kid": "apple-key"}), private_key.public_key()


def test_verifier_accepts_signed_apple_notification(monkeypatch: MonkeyPatch) -> None:
    token, public_key = apple_notification_token()
    class StubJWKClient:
        def __init__(self, url: str) -> None:
            self.url = url
        def get_signing_key_from_jwt(self, payload: str) -> object:
            return SimpleNamespace(key=public_key)
    monkeypatch.setattr("app.services.apple_notifications.PyJWKClient", StubJWKClient)
    settings = Settings(apple_notification_audiences="com.ashwoodfriends.alive", oauth_jwt_leeway_seconds=10**9)
    change = AppleNotificationVerifier(settings).verify(token)
    assert change == AppleAccountChange("com.ashwoodfriends.alive", "event-1", "consent-revoked", "apple-user")


def test_verifier_rejects_wrong_audience(monkeypatch: MonkeyPatch) -> None:
    token, public_key = apple_notification_token("wrong-client")
    class StubJWKClient:
        def __init__(self, url: str) -> None:
            self.url = url
        def get_signing_key_from_jwt(self, payload: str) -> object:
            return SimpleNamespace(key=public_key)
    monkeypatch.setattr("app.services.apple_notifications.PyJWKClient", StubJWKClient)
    verifier = AppleNotificationVerifier(Settings(apple_notification_audiences="expected-client", oauth_jwt_leeway_seconds=10**9))
    with raises(BadRequestError, match="verification failed"):
        verifier.verify(token)


def test_consent_revocation_disables_session_and_deletes_credentials() -> None:
    session = StubSession()
    service = AppleNotificationService(Settings(), cast(AsyncSession, session))
    user = StubUser(uuid4())
    deleted: list[tuple[str, str]] = []
    service.users = SimpleNamespace(get_by_provider=lambda provider, subject: async_value(user))
    service.credentials = SimpleNamespace(delete_for_subject=lambda subject, audience: async_append(deleted, (subject, audience)))
    status = asyncio.run(service._apply(AppleAccountChange("client", "event", "consent-revoked", "subject")))
    assert status == "processed"
    assert user.auth_revoked_at is not None
    assert deleted == [("subject", "client")]


def test_email_notification_updates_forwarding_state() -> None:
    service = AppleNotificationService(Settings(), cast(AsyncSession, StubSession()))
    updates: list[tuple[str, str, bool]] = []
    service.credentials = SimpleNamespace(set_email_forwarding=lambda subject, audience, enabled: async_append(updates, (subject, audience, enabled)))
    status = asyncio.run(service._apply(AppleAccountChange("client", "event", "email-disabled", "subject")))
    assert status == "processed"
    assert updates == [("subject", "client", False)]


def test_account_deleted_notification_removes_local_user() -> None:
    service = AppleNotificationService(Settings(), cast(AsyncSession, StubSession()))
    user = StubUser(uuid4())
    deleted: list[object] = []
    service.users = SimpleNamespace(get_by_provider=lambda provider, subject: async_value(user), delete_account=lambda value: async_append(deleted, value))
    status = asyncio.run(service._apply(AppleAccountChange("client", "event", "account-deleted", "subject")))
    assert status == "processed"
    assert deleted == [user]


def test_unknown_notification_is_recorded_as_ignored() -> None:
    service = AppleNotificationService(Settings(), cast(AsyncSession, StubSession()))
    service.users = SimpleNamespace(get_by_provider=lambda provider, subject: async_value(None))
    status = asyncio.run(service._apply(AppleAccountChange("client", "event", "future-event", "subject")))
    assert status == "ignored"


def test_duplicate_notification_returns_without_commit() -> None:
    session = StubSession()
    service = AppleNotificationService(Settings(), cast(AsyncSession, session))
    service.verifier = SimpleNamespace(verify=lambda payload: AppleAccountChange("client", "event", "email-enabled", "subject"))
    service.events = SimpleNamespace(claim=lambda *args: async_value(None))
    asyncio.run(service.process("signed-payload"))
    assert session.commits == 0


async def async_value(value: object) -> object:
    return value


async def async_append(target: list[object], value: object) -> None:
    target.append(value)
