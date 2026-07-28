from __future__ import annotations

import logging
from uuid import UUID

import httpx

from app.core.config import Settings
from app.core.errors import ServiceUnavailableError
from app.core.token_encryption import TokenCipher
from app.repositories.apple_credentials import AppleCredentialsRepository
from app.services.apple_client_secret import AppleClientSecretFactory


APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke"
INVALID_TOKEN_ERRORS = {"invalid_grant", "invalid_token"}
logger = logging.getLogger(__name__)


class AppleTokenRevoker:
    def __init__(self, settings: Settings, credentials: AppleCredentialsRepository) -> None:
        self.credentials = credentials
        self.secrets = AppleClientSecretFactory(settings)
        self.settings = settings

    async def revoke_all(self, user_id: UUID) -> int:
        credentials = await self.credentials.list_for_user(user_id)
        for credential in credentials:
            token = TokenCipher(self.settings).decrypt(credential.refresh_token_encrypted)
            await self._revoke(credential.client_id, token)
        return len(credentials)

    async def _revoke(self, client_id: str, token: str) -> None:
        secret = self.secrets.create(client_id, self._fallback_secret(client_id))
        payload = {"client_id": client_id, "client_secret": secret, "token": token, "token_type_hint": "refresh_token"}
        response = await self._post(payload)
        if response.status_code < 400 or self._already_invalid(response):
            logger.info("Revoked Apple OAuth token client_id=%s", client_id)
            return
        raise ServiceUnavailableError("Apple token revocation failed")

    async def _post(self, payload: dict[str, str]) -> httpx.Response:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                return await client.post(APPLE_REVOKE_URL, data=payload)
        except httpx.HTTPError as exc:
            raise ServiceUnavailableError("Apple token revocation is temporarily unavailable") from exc

    def _already_invalid(self, response: httpx.Response) -> bool:
        try:
            data: object = response.json()
        except ValueError:
            return False
        return isinstance(data, dict) and data.get("error") in INVALID_TOKEN_ERRORS

    def _fallback_secret(self, client_id: str) -> str:
        if client_id == self.settings.apple_native_client_id:
            return self.settings.apple_native_client_secret
        if client_id == self.settings.apple_client_id:
            return self.settings.apple_client_secret
        return ""
