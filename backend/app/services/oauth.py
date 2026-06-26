from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlencode

import httpx
import jwt
from jwt import PyJWKClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import BadRequestError
from app.core.security import sign_oauth_state, sign_session, verify_oauth_state
from app.models import UserProvider
from app.repositories.users import UserRepository


@dataclass(frozen=True)
class ProviderIdentity:
    provider: UserProvider
    subject: str
    email: str
    display_name: str


class OAuthService:
    def __init__(self, settings: Settings, session: AsyncSession) -> None:
        self.settings = settings
        self.users = UserRepository(session)
        self.session = session

    def auth_url(self, provider: UserProvider) -> str:
        if provider == UserProvider.google:
            return self._google_auth_url()
        if provider == UserProvider.apple:
            return self._apple_auth_url()
        raise BadRequestError("Unsupported provider")

    async def complete(self, provider: UserProvider, code: str, state: str) -> str:
        self._validate_state(provider, state)
        identity = await self._provider_identity(provider, code)
        user = await self.users.get_or_create_provider_user(identity.email, identity.provider, identity.subject, identity.display_name)
        await self.session.commit()
        return sign_session(user.id, self.settings.auth_session_ttl_seconds, self.settings.auth_secret_key)

    def _validate_state(self, provider: UserProvider, state: str) -> None:
        if verify_oauth_state(state, provider.value, self.settings.auth_secret_key):
            return
        raise BadRequestError("Invalid OAuth state")

    async def _provider_identity(self, provider: UserProvider, code: str) -> ProviderIdentity:
        if provider == UserProvider.google:
            return await self._google_identity(code)
        if provider == UserProvider.apple:
            return await self._apple_identity(code)
        raise BadRequestError("Unsupported provider")

    def _google_auth_url(self) -> str:
        state = sign_oauth_state("google", 600, self.settings.auth_secret_key)
        params = self._auth_params(self.settings.google_client_id, self.settings.google_redirect_uri, "openid email profile", state)
        return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"

    def _apple_auth_url(self) -> str:
        state = sign_oauth_state("apple", 600, self.settings.auth_secret_key)
        params = self._auth_params(self.settings.apple_client_id, self.settings.apple_redirect_uri, "name email", state)
        params["response_mode"] = "form_post"
        return f"https://appleid.apple.com/auth/authorize?{urlencode(params)}"

    def _auth_params(self, client_id: str, redirect_uri: str, scope: str, state: str) -> dict[str, str]:
        self._require_client_id(client_id)
        return {"client_id": client_id, "redirect_uri": redirect_uri, "response_type": "code", "scope": scope, "state": state}

    def _require_client_id(self, client_id: str) -> None:
        if client_id:
            return
        raise BadRequestError("OAuth client id is not configured")

    async def _google_identity(self, code: str) -> ProviderIdentity:
        token = await self._exchange_google_code(code)
        claims = self._verify_jwt(token["id_token"], self.settings.google_client_id, "https://accounts.google.com", "https://www.googleapis.com/oauth2/v3/certs")
        return self._identity_from_claims(UserProvider.google, claims)

    async def _apple_identity(self, code: str) -> ProviderIdentity:
        token = await self._exchange_apple_code(code)
        claims = self._verify_jwt(token["id_token"], self.settings.apple_client_id, "https://appleid.apple.com", "https://appleid.apple.com/auth/keys")
        return self._identity_from_claims(UserProvider.apple, claims)

    async def _exchange_google_code(self, code: str) -> dict[str, str]:
        payload = self._token_payload(code, self.settings.google_client_id, self.settings.google_client_secret, self.settings.google_redirect_uri)
        return await self._post_token("https://oauth2.googleapis.com/token", payload)

    async def _exchange_apple_code(self, code: str) -> dict[str, str]:
        payload = self._token_payload(code, self.settings.apple_client_id, self.settings.apple_client_secret, self.settings.apple_redirect_uri)
        return await self._post_token("https://appleid.apple.com/auth/token", payload)

    def _token_payload(self, code: str, client_id: str, secret: str, redirect_uri: str) -> dict[str, str]:
        if not client_id or not secret:
            raise BadRequestError("OAuth client credentials are not configured")
        return {"code": code, "client_id": client_id, "client_secret": secret, "redirect_uri": redirect_uri, "grant_type": "authorization_code"}

    async def _post_token(self, url: str, payload: dict[str, str]) -> dict[str, str]:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(url, data=payload)
        if response.status_code >= 400:
            raise BadRequestError("OAuth token exchange failed")
        return response.json()

    def _verify_jwt(self, token: str, audience: str, issuer: str, jwks_url: str) -> dict[str, object]:
        key = PyJWKClient(jwks_url).get_signing_key_from_jwt(token)
        return jwt.decode(token, key.key, algorithms=["RS256"], audience=audience, issuer=issuer)

    def _identity_from_claims(self, provider: UserProvider, claims: dict[str, object]) -> ProviderIdentity:
        subject = str(claims.get("sub") or "")
        email = str(claims.get("email") or "")
        if not subject or not email:
            raise BadRequestError("OAuth identity is missing required claims")
        return ProviderIdentity(provider=provider, subject=subject, email=email, display_name=self._display_name(email, claims))

    def _display_name(self, email: str, claims: dict[str, object]) -> str:
        name = str(claims.get("name") or "")
        return name or email.split("@")[0]
