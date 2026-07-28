from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timedelta, timezone

import jwt

from app.core.config import Settings
from app.core.errors import BadRequestError


APPLE_TOKEN_AUDIENCE = "https://appleid.apple.com"


class AppleClientSecretFactory:
    def __init__(self, settings: Settings, clock: Callable[[], datetime] | None = None) -> None:
        self.settings = settings
        self.clock = clock or (lambda: datetime.now(timezone.utc))

    def create(self, client_id: str, fallback: str = "") -> str:
        if self._has_signing_credentials():
            return self._encode(client_id)
        if fallback:
            return fallback
        raise BadRequestError("Apple client credentials are not configured")

    def _has_signing_credentials(self) -> bool:
        values = (self.settings.apple_team_id, self.settings.apple_key_id, self.settings.apple_private_key)
        return all(values)

    def _encode(self, client_id: str) -> str:
        if not client_id:
            raise BadRequestError("Apple client id is not configured")
        headers = {"alg": "ES256", "kid": self.settings.apple_key_id}
        return jwt.encode(self._claims(client_id), self._private_key(), algorithm="ES256", headers=headers)

    def _claims(self, client_id: str) -> dict[str, object]:
        issued_at = self.clock()
        expires_at = issued_at + timedelta(minutes=10)
        return {"iss": self.settings.apple_team_id, "iat": issued_at, "exp": expires_at, "aud": APPLE_TOKEN_AUDIENCE, "sub": client_id}

    def _private_key(self) -> str:
        return self.settings.apple_private_key.replace("\\n", "\n")
