from __future__ import annotations

from hashlib import sha256

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import BadRequestError, ServiceUnavailableError
from app.core.identity import account_identity_fingerprint
from app.core.security import sign_session
from app.models import UserProvider
from app.repositories.users import UserRepository
from app.services.oauth import OAuthCompletion


TOSS_LOGIN_TOKEN_PATH = "/api-partner/v1/apps-in-toss/user/oauth2/generate-token"
TOSS_LOGIN_ME_PATH = "/api-partner/v1/apps-in-toss/user/oauth2/login-me"
TOSS_FALLBACK_EMAIL_DOMAIN = "toss-login.ashwoodfriends.com"
TOSS_FALLBACK_DIGEST_LENGTH = 58


class TossLoginService:
    def __init__(self, settings: Settings, session: AsyncSession) -> None:
        self.settings = settings
        self.session = session
        self.users = UserRepository(session)

    async def complete(self, authorization_code: str, referrer: str) -> OAuthCompletion:
        access_token = await self._access_token(authorization_code, referrer)
        user_key = await self._user_key(access_token)
        subject = str(user_key)
        user = await self.users.get_or_create_provider_user(self._fallback_email(subject), UserProvider.toss, subject, "", account_identity_fingerprint(self.settings, UserProvider.toss, subject))
        await self.session.commit()
        token = sign_session(user.id, self.settings.auth_session_ttl_seconds, self.settings.auth_secret_key, user.session_version)
        return OAuthCompletion(session_token=token, user_id=user.id)

    async def _access_token(self, authorization_code: str, referrer: str) -> str:
        payload = {"authorizationCode": authorization_code, "referrer": referrer}
        response = await self._post(TOSS_LOGIN_TOKEN_PATH, payload)
        return self._required_string(self._success_payload(response), "accessToken")

    async def _user_key(self, access_token: str) -> int:
        response = await self._get(TOSS_LOGIN_ME_PATH, {"Authorization": f"Bearer {access_token}"})
        value = self._success_payload(response).get("userKey")
        if isinstance(value, int) and not isinstance(value, bool) and value > 0:
            return value
        raise BadRequestError("Toss login user response is invalid")

    async def _post(self, path: str, payload: dict[str, str]) -> dict[str, object]:
        try:
            async with self._client() as client:
                response = await client.post(f"{self.settings.toss_api_base_url}{path}", json=payload)
        except httpx.HTTPError as exc:
            raise ServiceUnavailableError("Toss login is temporarily unavailable") from exc
        return self._response_data(response)

    async def _get(self, path: str, headers: dict[str, str]) -> dict[str, object]:
        try:
            async with self._client() as client:
                response = await client.get(f"{self.settings.toss_api_base_url}{path}", headers=headers)
        except httpx.HTTPError as exc:
            raise ServiceUnavailableError("Toss login is temporarily unavailable") from exc
        return self._response_data(response)

    def _client(self) -> httpx.AsyncClient:
        certificate = self._certificate()
        return httpx.AsyncClient(timeout=10.0, cert=certificate)

    def _certificate(self) -> tuple[str, str]:
        certificate = self.settings.toss_mtls_cert_path
        private_key = self.settings.toss_mtls_key_path
        if certificate and private_key:
            return certificate, private_key
        raise BadRequestError("Toss mTLS certificate is not configured")

    def _response_data(self, response: httpx.Response) -> dict[str, object]:
        if response.status_code >= 500:
            raise ServiceUnavailableError("Toss login is temporarily unavailable")
        if response.status_code >= 400:
            raise BadRequestError("Toss login failed")
        try:
            data: object = response.json()
        except ValueError as exc:
            raise BadRequestError("Toss login response is invalid") from exc
        if isinstance(data, dict) and all(isinstance(key, str) for key in data):
            return data
        raise BadRequestError("Toss login response is invalid")

    def _success_payload(self, response: dict[str, object]) -> dict[str, object]:
        success = response.get("success")
        if response.get("resultType") == "SUCCESS" and isinstance(success, dict):
            return {str(key): value for key, value in success.items()}
        raise BadRequestError("Toss login failed")

    def _required_string(self, response: dict[str, object], key: str) -> str:
        value = response.get(key)
        if isinstance(value, str) and value:
            return value
        raise BadRequestError("Toss login response is invalid")

    def _fallback_email(self, subject: str) -> str:
        digest = sha256(subject.encode()).hexdigest()[:TOSS_FALLBACK_DIGEST_LENGTH]
        return f"toss-{digest}@{TOSS_FALLBACK_EMAIL_DOMAIN}"
