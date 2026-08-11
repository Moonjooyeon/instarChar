from __future__ import annotations

from hashlib import sha256

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import BadRequestError
from app.core.identity import account_identity_fingerprint
from app.core.security import sign_session
from app.models import UserProvider
from app.repositories.users import UserRepository
from app.services.oauth import OAuthCompletion
from app.services.toss_api import TossApiClient


TOSS_LOGIN_TOKEN_PATH = "/api-partner/v1/apps-in-toss/user/oauth2/generate-token"
TOSS_LOGIN_ME_PATH = "/api-partner/v1/apps-in-toss/user/oauth2/login-me"
TOSS_FALLBACK_EMAIL_DOMAIN = "toss-login.ashwoodfriends.com"
TOSS_FALLBACK_DIGEST_LENGTH = 58


class TossLoginService:
    def __init__(self, settings: Settings, session: AsyncSession) -> None:
        self.settings = settings
        self.session = session
        self.users = UserRepository(session)
        self.api = TossApiClient(settings)

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
        response = await self.api.post(TOSS_LOGIN_TOKEN_PATH, payload)
        return self._required_string(response, "accessToken")

    async def _user_key(self, access_token: str) -> int:
        response = await self.api.get(TOSS_LOGIN_ME_PATH, {"Authorization": f"Bearer {access_token}"})
        value = response.get("userKey")
        if isinstance(value, int) and not isinstance(value, bool) and value > 0:
            return value
        raise BadRequestError("Toss login user response is invalid")

    def _required_string(self, response: dict[str, object], key: str) -> str:
        value = response.get(key)
        if isinstance(value, str) and value:
            return value
        raise BadRequestError("Toss login response is invalid")

    def _fallback_email(self, subject: str) -> str:
        digest = sha256(subject.encode()).hexdigest()[:TOSS_FALLBACK_DIGEST_LENGTH]
        return f"toss-{digest}@{TOSS_FALLBACK_EMAIL_DOMAIN}"
