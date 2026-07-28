from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256
import logging

import jwt
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import BadRequestError
from app.models import UserProvider
from app.repositories.apple_account_events import AppleAccountEventsRepository
from app.repositories.apple_credentials import AppleCredentialsRepository
from app.repositories.users import UserRepository


APPLE_ISSUER = "https://appleid.apple.com"
APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"
EMAIL_EVENTS = {"email-enabled": True, "email-disabled": False}
logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AppleAccountChange:
    audience: str
    event_id: str
    event_type: str
    subject: str


class AppleNotificationVerifier:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def verify(self, payload: str) -> AppleAccountChange:
        audiences = self.settings.allowed_apple_notification_audiences
        if not audiences:
            raise BadRequestError("Apple notification audience is not configured")
        claims = self._decode(payload, audiences)
        events = claims.get("events")
        if not isinstance(events, dict):
            raise BadRequestError("Apple notification events are invalid")
        return AppleAccountChange(self._string(claims, "aud"), self._string(claims, "jti"), self._string(events, "type"), self._string(events, "sub"))

    def _decode(self, payload: str, audiences: list[str]) -> dict[str, object]:
        try:
            key = PyJWKClient(APPLE_JWKS_URL).get_signing_key_from_jwt(payload)
            options = {"require": ["iss", "aud", "iat", "jti", "events"]}
            return jwt.decode(payload, key.key, algorithms=["RS256"], audience=audiences, issuer=APPLE_ISSUER, leeway=self.settings.oauth_jwt_leeway_seconds, options=options)
        except (jwt.PyJWTError, PyJWKClientError) as exc:
            raise BadRequestError("Apple notification verification failed") from exc

    def _string(self, values: dict[str, object], key: str) -> str:
        value = values.get(key)
        if isinstance(value, str) and value:
            return value
        raise BadRequestError("Apple notification payload is invalid")


class AppleNotificationService:
    def __init__(self, settings: Settings, session: AsyncSession) -> None:
        self.credentials = AppleCredentialsRepository(session)
        self.events = AppleAccountEventsRepository(session)
        self.session = session
        self.users = UserRepository(session)
        self.verifier = AppleNotificationVerifier(settings)

    async def process(self, payload: str) -> None:
        change = self.verifier.verify(payload)
        event_id = await self.events.claim(change.event_id, change.event_type, change.subject, sha256(payload.encode()).hexdigest())
        if not event_id:
            return
        status = await self._apply(change)
        await self.events.complete(event_id, status)
        await self.session.commit()
        logger.info("Processed Apple account event type=%s status=%s", change.event_type, status)

    async def _apply(self, change: AppleAccountChange) -> str:
        if change.event_type in EMAIL_EVENTS:
            await self.credentials.set_email_forwarding(change.subject, change.audience, EMAIL_EVENTS[change.event_type])
            return "processed"
        user = await self.users.get_by_provider(UserProvider.apple, change.subject)
        if not user:
            return "ignored"
        if change.event_type == "consent-revoked":
            user.auth_revoked_at = datetime.now(timezone.utc)
            await self.credentials.delete_for_subject(change.subject, change.audience)
            return "processed"
        if change.event_type == "account-deleted":
            await self.users.delete_account(user)
            return "processed"
        return "ignored"
