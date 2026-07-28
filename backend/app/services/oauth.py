from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from hmac import compare_digest
from urllib.parse import urlencode
from uuid import UUID

import httpx
import jwt
from jwt import PyJWKClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import BadRequestError, ServiceUnavailableError
from app.core.security import OAuthStatePayload, read_oauth_state, sign_oauth_state, sign_session
from app.core.token_encryption import TokenCipher
from app.models import UserProvider
from app.repositories.apple_credentials import AppleCredentialsRepository
from app.repositories.users import UserRepository
from app.services.apple_client_secret import AppleClientSecretFactory


SAFE_OAUTH_ERROR_CODES = frozenset({"invalid_client", "invalid_grant", "invalid_request", "unauthorized_client", "unsupported_grant_type"})


@dataclass(frozen=True)
class ProviderIdentity:
    provider: UserProvider
    subject: str
    email: str
    display_name: str


@dataclass(frozen=True)
class OAuthCompletion:
    session_token: str
    user_id: UUID


@dataclass(frozen=True)
class AppleTokenSet:
    access_token: str
    expires_in: int
    refresh_token: str


@dataclass(frozen=True)
class ProviderAuthentication:
    client_id: str
    identity: ProviderIdentity
    tokens: AppleTokenSet | None = None


class OAuthService:
    def __init__(self, settings: Settings, session: AsyncSession) -> None:
        self.settings = settings
        self.apple_credentials = AppleCredentialsRepository(session)
        self.apple_client_secrets = AppleClientSecretFactory(settings)
        self.users = UserRepository(session)
        self.session = session

    def auth_url(self, provider: UserProvider, redirect_uri: str = "", return_url: str = "") -> str:
        if provider == UserProvider.google:
            return self._google_auth_url(redirect_uri, return_url)
        if provider == UserProvider.apple:
            return self._apple_auth_url(redirect_uri, return_url)
        raise BadRequestError("Unsupported provider")

    async def complete(self, provider: UserProvider, code: str, state: str) -> OAuthCompletion:
        state_payload = self._require_oauth_state(provider, state)
        authentication = await self._provider_authentication(provider, code, state_payload.redirect_uri)
        return await self._complete_identity(authentication.identity, authentication.tokens, authentication.client_id)

    async def complete_native_apple(self, code: str, identity_token: str, nonce: str, display_name: str) -> OAuthCompletion:
        device_claims = self._verify_apple_native_token(identity_token)
        self._require_apple_nonce(device_claims, nonce)
        token = await self._exchange_native_apple_code(code)
        server_claims = self._verify_apple_native_token(self._required_id_token(token))
        self._require_same_apple_user(device_claims, server_claims)
        identity = self._identity_from_claims(UserProvider.apple, server_claims, display_name)
        tokens = self._apple_tokens(token)
        return await self._complete_identity(identity, tokens, self.settings.apple_native_client_id)

    async def _complete_identity(self, identity: ProviderIdentity, tokens: AppleTokenSet | None = None, client_id: str = "") -> OAuthCompletion:
        user = await self.users.get_or_create_provider_user(identity.email, identity.provider, identity.subject, identity.display_name)
        if tokens:
            await self._store_apple_credentials(user.id, client_id, identity.subject, tokens)
        await self.session.commit()
        token = sign_session(user.id, self.settings.auth_session_ttl_seconds, self.settings.auth_secret_key)
        return OAuthCompletion(session_token=token, user_id=user.id)

    def _require_oauth_state(self, provider: UserProvider, state: str) -> OAuthStatePayload:
        payload = self._oauth_state(provider, state)
        if payload:
            return payload
        raise BadRequestError("Invalid OAuth state")

    def frontend_redirect_url(self, provider: UserProvider, state: str) -> str:
        payload = self._oauth_state(provider, state)
        if payload and payload.return_url:
            return payload.return_url
        return self.settings.frontend_redirect_url

    def _oauth_state(self, provider: UserProvider, state: str) -> OAuthStatePayload | None:
        return read_oauth_state(state, provider.value, self.settings.auth_secret_key)

    async def _provider_authentication(self, provider: UserProvider, code: str, redirect_uri: str) -> ProviderAuthentication:
        if provider == UserProvider.google:
            return ProviderAuthentication("", await self._google_identity(code, redirect_uri))
        if provider == UserProvider.apple:
            return await self._apple_authentication(code, redirect_uri)
        raise BadRequestError("Unsupported provider")

    def _google_auth_url(self, redirect_uri: str, return_url: str) -> str:
        callback_uri = redirect_uri or self.settings.google_redirect_uri
        state = sign_oauth_state("google", 600, self.settings.auth_secret_key, callback_uri, return_url)
        params = self._auth_params(self.settings.google_client_id, callback_uri, "openid email profile", state)
        return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"

    def _apple_auth_url(self, redirect_uri: str, return_url: str) -> str:
        callback_uri = redirect_uri or self.settings.apple_redirect_uri
        state = sign_oauth_state("apple", 600, self.settings.auth_secret_key, callback_uri, return_url)
        params = self._auth_params(self.settings.apple_client_id, callback_uri, "name email", state)
        params["response_mode"] = "form_post"
        return f"https://appleid.apple.com/auth/authorize?{urlencode(params)}"

    def _auth_params(self, client_id: str, redirect_uri: str, scope: str, state: str) -> dict[str, str]:
        self._require_client_id(client_id)
        return {"client_id": client_id, "redirect_uri": redirect_uri, "response_type": "code", "scope": scope, "state": state}

    def _require_client_id(self, client_id: str) -> None:
        if client_id:
            return
        raise BadRequestError("OAuth client id is not configured")

    async def _google_identity(self, code: str, redirect_uri: str) -> ProviderIdentity:
        token = await self._exchange_google_code(code, redirect_uri)
        identity_token = self._required_string(token, "id_token", "OAuth token response is invalid")
        claims = self._verify_jwt(identity_token, self.settings.google_client_id, "https://accounts.google.com", "https://www.googleapis.com/oauth2/v3/certs")
        return self._identity_from_claims(UserProvider.google, claims)

    async def _apple_authentication(self, code: str, redirect_uri: str) -> ProviderAuthentication:
        token = await self._exchange_apple_code(code, redirect_uri)
        claims = self._verify_jwt(self._required_id_token(token), self.settings.apple_client_id, "https://appleid.apple.com", "https://appleid.apple.com/auth/keys")
        identity = self._identity_from_claims(UserProvider.apple, claims)
        return ProviderAuthentication(self.settings.apple_client_id, identity, self._apple_tokens(token))

    async def _exchange_google_code(self, code: str, redirect_uri: str) -> dict[str, object]:
        payload = self._token_payload(code, self.settings.google_client_id, self.settings.google_client_secret, redirect_uri or self.settings.google_redirect_uri)
        return await self._post_token("https://oauth2.googleapis.com/token", payload)

    async def _exchange_apple_code(self, code: str, redirect_uri: str) -> dict[str, object]:
        secret = self.apple_client_secrets.create(self.settings.apple_client_id, self.settings.apple_client_secret)
        payload = self._token_payload(code, self.settings.apple_client_id, secret, redirect_uri or self.settings.apple_redirect_uri)
        return await self._post_token("https://appleid.apple.com/auth/token", payload)

    async def _exchange_native_apple_code(self, code: str) -> dict[str, object]:
        secret = self.apple_client_secrets.create(self.settings.apple_native_client_id, self.settings.apple_native_client_secret)
        payload = self._token_payload(code, self.settings.apple_native_client_id, secret, "")
        payload.pop("redirect_uri")
        return await self._post_token("https://appleid.apple.com/auth/token", payload)

    def _token_payload(self, code: str, client_id: str, secret: str, redirect_uri: str) -> dict[str, str]:
        if not client_id or not secret:
            raise BadRequestError("OAuth client credentials are not configured")
        return {"code": code, "client_id": client_id, "client_secret": secret, "redirect_uri": redirect_uri, "grant_type": "authorization_code"}

    async def _post_token(self, url: str, payload: dict[str, str]) -> dict[str, object]:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(url, data=payload)
        except httpx.HTTPError as exc:
            raise ServiceUnavailableError("OAuth provider is temporarily unavailable") from exc
        if response.status_code >= 500:
            raise ServiceUnavailableError("OAuth provider is temporarily unavailable")
        if response.status_code >= 400:
            raise self._token_exchange_error(response)
        data: object = response.json()
        if not isinstance(data, dict) or not all(isinstance(key, str) for key in data):
            raise BadRequestError("OAuth token response is invalid")
        return data

    def _token_exchange_error(self, response: httpx.Response) -> BadRequestError:
        try:
            data: object = response.json()
        except ValueError:
            return BadRequestError("OAuth token exchange failed")
        code = data.get("error") if isinstance(data, dict) else None
        if not isinstance(code, str) or code not in SAFE_OAUTH_ERROR_CODES:
            return BadRequestError("OAuth token exchange failed")
        return BadRequestError(f"OAuth token exchange failed: {code}")

    def _verify_jwt(self, token: str, audience: str, issuer: str, jwks_url: str) -> dict[str, object]:
        try:
            key = PyJWKClient(jwks_url).get_signing_key_from_jwt(token)
            return jwt.decode(token, key.key, algorithms=["RS256"], audience=audience, issuer=issuer, leeway=self.settings.oauth_jwt_leeway_seconds)
        except jwt.PyJWTError as exc:
            raise BadRequestError("OAuth identity verification failed") from exc

    def _verify_apple_native_token(self, token: str) -> dict[str, object]:
        return self._verify_jwt(token, self.settings.apple_native_client_id, "https://appleid.apple.com", "https://appleid.apple.com/auth/keys")

    def _required_id_token(self, token: dict[str, object]) -> str:
        return self._required_string(token, "id_token", "Apple token exchange failed")

    def _required_string(self, values: dict[str, object], key: str, message: str) -> str:
        value = values.get(key)
        if isinstance(value, str) and value:
            return value
        raise BadRequestError(message)

    def _apple_tokens(self, values: dict[str, object]) -> AppleTokenSet:
        refresh_token = self._required_string(values, "refresh_token", "Apple refresh token is missing")
        access_token = self._required_string(values, "access_token", "Apple access token is missing")
        expires_in = values.get("expires_in")
        if isinstance(expires_in, int) and expires_in > 0:
            return AppleTokenSet(access_token, expires_in, refresh_token)
        raise BadRequestError("Apple access token expiry is invalid")

    async def _store_apple_credentials(self, user_id: UUID, client_id: str, subject: str, tokens: AppleTokenSet) -> None:
        cipher = TokenCipher(self.settings)
        refresh_token = cipher.encrypt(tokens.refresh_token)
        access_token = cipher.encrypt(tokens.access_token)
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=tokens.expires_in)
        await self.apple_credentials.upsert(user_id, client_id, subject, refresh_token, access_token, expires_at)

    def _require_apple_nonce(self, claims: dict[str, object], nonce: str) -> None:
        claim = str(claims.get("nonce") or "")
        if nonce and compare_digest(claim, nonce):
            return
        raise BadRequestError("Apple identity verification failed")

    def _require_same_apple_user(self, device_claims: dict[str, object], server_claims: dict[str, object]) -> None:
        device_subject = str(device_claims.get("sub") or "")
        server_subject = str(server_claims.get("sub") or "")
        if device_subject and compare_digest(device_subject, server_subject):
            return
        raise BadRequestError("Apple identity verification failed")

    def _identity_from_claims(self, provider: UserProvider, claims: dict[str, object], display_name: str = "") -> ProviderIdentity:
        subject = str(claims.get("sub") or "")
        email = str(claims.get("email") or "")
        if not subject or not email:
            raise BadRequestError("OAuth identity is missing required claims")
        name = display_name.strip() or self._display_name(email, claims)
        return ProviderIdentity(provider=provider, subject=subject, email=email, display_name=name)

    def _display_name(self, email: str, claims: dict[str, object]) -> str:
        name = str(claims.get("name") or "")
        return name or email.split("@")[0]
