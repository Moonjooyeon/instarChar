import asyncio
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Optional
from urllib.parse import parse_qs, urlsplit
from uuid import uuid4

from cryptography.fernet import Fernet
from fastapi import Response
from fastapi.testclient import TestClient
from jwt.exceptions import ImmatureSignatureError, PyJWKClientError
from pytest import LogCaptureFixture, MonkeyPatch, raises

from app.api.deps import _load_user, get_current_user
from app.core.config import Settings, get_settings
from app.core.errors import BadRequestError, ServiceUnavailableError, UnauthorizedError
from app.core.security import _signature, read_oauth_state, sign_oauth_state
from app.db.session import get_db_session
from app.main import app
from app.models import UserAccountStatus, UserModerationStatus, UserProvider
from app.schemas.auth import UserResponse
from app.services.oauth import OAuthCompletion, OAuthService, ProviderIdentity


@dataclass
class StubProfile:
    display_name: str = "테스터"
    onboarded: bool = True


@dataclass
class StubUser:
    id: object
    email: str
    provider: UserProvider
    profile: Optional[StubProfile]
    moderation_status: UserModerationStatus = UserModerationStatus.active
    account_status: UserAccountStatus = UserAccountStatus.active
    auth_revoked_at: Optional[datetime] = None
    session_version: int = 0


class StubSession:
    async def commit(self) -> None:
        return None


async def stub_db_session() -> AsyncIterator[StubSession]:
    yield StubSession()


async def stub_current_user() -> StubUser:
    return StubUser(id=uuid4(), email="tester@example.com", provider=UserProvider.google, profile=StubProfile())


async def stub_current_user_without_profile() -> StubUser:
    return StubUser(id=uuid4(), email="tester@example.com", provider=UserProvider.google, profile=None)


def test_health_check() -> None:
    with make_test_client() as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_google_start_redirects_to_google_oauth() -> None:
    with make_test_client() as client:
        response = client.get("/api/auth/google/start", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"].startswith("https://accounts.google.com/o/oauth2/v2/auth?")


def test_google_start_uses_browser_origin_callback_url() -> None:
    callback_url = "http://192.168.0.2:5173/api/auth/google/callback"
    return_url = "http://192.168.0.2:5173"
    with make_test_client() as client:
        response = client.get("/api/auth/google/start", params={"redirect_uri": callback_url, "return_url": return_url}, follow_redirects=False)
    query = parse_qs(urlsplit(response.headers["location"]).query)
    state = read_oauth_state(query["state"][0], "google", "test-secret")
    assert response.status_code == 307
    assert query["redirect_uri"] == [callback_url]
    assert state is not None
    assert state.redirect_uri == callback_url
    assert state.return_url == return_url


def test_google_start_allows_separate_backend_and_frontend_ports() -> None:
    callback_url = "http://localhost:8000/api/auth/google/callback"
    return_url = "http://localhost:5173"
    with make_test_client() as client:
        response = client.get("/api/auth/google/start", params={"redirect_uri": callback_url, "return_url": return_url}, follow_redirects=False)
    assert response.status_code == 307
    assert parse_qs(urlsplit(response.headers["location"]).query)["redirect_uri"] == [callback_url]


def test_google_start_rejects_untrusted_frontend_origin() -> None:
    callback_url = "http://localhost:8000/api/auth/google/callback"
    with make_test_client() as client:
        response = client.get("/api/auth/google/start", params={"redirect_uri": callback_url, "return_url": "https://evil.example"}, follow_redirects=False)
    assert response.status_code == 400
    assert response.json()["message"] == "Invalid OAuth return URL"


def test_google_start_accepts_native_oauth_return_url() -> None:
    return_url = "com.ashwoodfriends.alive://oauth/callback"
    with make_test_client() as client:
        response = client.get("/api/auth/google/start", params={"return_url": return_url}, follow_redirects=False)
    state = read_oauth_state(parse_qs(urlsplit(response.headers["location"]).query)["state"][0], "google", "test-secret")
    assert response.status_code == 307
    assert state is not None
    assert state.return_url == return_url


def test_apple_start_redirects_to_apple_oauth() -> None:
    with make_test_client() as client:
        response = client.get("/api/auth/apple/start", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"].startswith("https://appleid.apple.com/auth/authorize?")


def test_me_returns_backend_user_dto() -> None:
    with make_test_client() as client:
        response = client.get("/api/auth/me")
    assert response.status_code == 200
    assert response.json()["user"]["provider"] == "google"
    assert response.json()["display_name"] == "테스터"


def test_me_tolerates_missing_profile_row() -> None:
    with make_test_client_with_profileless_user() as client:
        response = client.get("/api/auth/me")
    assert response.status_code == 200
    assert response.json()["display_name"] == ""
    assert response.json()["onboarded"] is False


def test_me_rejects_invalid_cookie_with_cors_headers() -> None:
    token = f"not-json.{_signature('not-json', 'test-secret')}"
    with make_test_client_without_auth_override() as client:
        client.cookies.set("alive_session", token)
        response = client.get("/api/auth/me", headers={"Origin": "http://localhost:5173"})
    assert response.status_code == 401
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert response.json()["message"] == "Authentication required"


def test_me_returns_cors_headers_on_unhandled_errors() -> None:
    with make_test_client_with_failing_auth() as client:
        response = client.get("/api/auth/me", headers={"Origin": "http://localhost:5173"})
    assert response.status_code == 500
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert response.json()["error"] == "INTERNAL_SERVER_ERROR"


def test_revoked_apple_authorization_invalidates_existing_session(monkeypatch: MonkeyPatch) -> None:
    user = StubUser(uuid4(), "tester@example.com", UserProvider.apple, StubProfile(), auth_revoked_at=datetime.now(timezone.utc))
    async def get_by_id(self: object, user_id: object) -> StubUser:
        return user
    monkeypatch.setattr("app.api.deps.UserRepository.get_by_id", get_by_id)
    with raises(UnauthorizedError, match="authorization has been revoked"):
        asyncio.run(_load_user(user.id, StubSession()))


def test_logout_clears_session_cookie() -> None:
    with make_test_client() as client:
        response = client.post("/api/auth/logout")
    assert response.status_code == 204
    assert "alive_session" in response.headers.get("set-cookie", "")


def test_delete_account_schedules_deletion_and_clears_cookie(monkeypatch: MonkeyPatch) -> None:
    purge_at = datetime(2026, 8, 16, tzinfo=timezone.utc)
    async def delete_account(self: object, user: StubUser) -> datetime:
        return purge_at
    monkeypatch.setattr("app.api.v1.auth.AccountDeletionService.delete", delete_account)
    with make_test_client() as client:
        response = client.delete("/api/auth/account")
    assert response.status_code == 200
    assert response.json() == {"status": "pending_deletion", "purge_at": "2026-08-16T00:00:00Z"}
    assert "alive_session" in response.headers.get("set-cookie", "")


def test_pending_deletion_account_is_not_authorized(monkeypatch: MonkeyPatch) -> None:
    user = StubUser(uuid4(), "tester@example.com", UserProvider.google, StubProfile(), account_status=UserAccountStatus.pending_deletion)
    async def get_by_id(self: object, user_id: object) -> StubUser:
        return user
    monkeypatch.setattr("app.api.deps.UserRepository.get_by_id", get_by_id)
    with raises(UnauthorizedError, match="Account deletion is pending"):
        asyncio.run(_load_user(user.id, StubSession()))


def test_old_session_version_is_not_authorized(monkeypatch: MonkeyPatch) -> None:
    user = StubUser(uuid4(), "tester@example.com", UserProvider.google, StubProfile(), session_version=2)
    async def get_by_id(self: object, user_id: object) -> StubUser:
        return user
    monkeypatch.setattr("app.api.deps.UserRepository.get_by_id", get_by_id)
    with raises(UnauthorizedError, match="Session expired"):
        asyncio.run(_load_user(user.id, StubSession(), 1))


def test_google_callback_sets_session_cookie(monkeypatch) -> None:
    async def complete(self: object, provider: UserProvider, code: str, state: str) -> OAuthCompletion:
        assert provider == UserProvider.google
        assert code == "code"
        assert state == "state"
        return OAuthCompletion(session_token="signed-session", user_id=uuid4())

    monkeypatch.setattr("app.api.v1.auth.OAuthService.complete", complete)
    with make_test_client() as client:
        response = client.get("/api/auth/google/callback?code=code&state=state", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "http://localhost:5173"
    assert "signed-session" in response.headers["set-cookie"]


def test_google_callback_uses_state_return_url(monkeypatch: MonkeyPatch) -> None:
    async def complete(self: object, provider: UserProvider, code: str, state: str) -> OAuthCompletion:
        return OAuthCompletion(session_token="signed-session", user_id=uuid4())
    state = sign_oauth_state("google", 60, "test-secret", "http://192.168.0.2:5173/api/auth/google/callback", "http://192.168.0.2:5173")
    monkeypatch.setattr("app.api.v1.auth.OAuthService.complete", complete)
    with make_test_client() as client:
        response = client.get("/api/auth/google/callback", params={"code": "code", "state": state}, follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "http://192.168.0.2:5173"
    assert "signed-session" in response.headers["set-cookie"]


def test_google_callback_issues_native_one_time_code(monkeypatch: MonkeyPatch) -> None:
    user_id = uuid4()
    async def complete(self: object, provider: UserProvider, code: str, state: str) -> OAuthCompletion:
        return OAuthCompletion(session_token="signed-session", user_id=user_id)
    async def issue(self: object, requested_user_id: object) -> str:
        assert requested_user_id == user_id
        return "one-time-code"
    return_url = "com.ashwoodfriends.alive://oauth/callback"
    state = sign_oauth_state("google", 60, "test-secret", "", return_url)
    monkeypatch.setattr("app.api.v1.auth.OAuthService.complete", complete)
    monkeypatch.setattr("app.api.v1.auth.NativeOAuthService.issue", issue)
    with make_test_client() as client:
        response = client.get("/api/auth/google/callback", params={"code": "code", "state": state}, follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == f"{return_url}?code=one-time-code"
    assert "alive_session" not in response.headers.get("set-cookie", "")


def test_native_oauth_exchange_sets_session_cookie(monkeypatch: MonkeyPatch) -> None:
    async def consume(self: object, code: str) -> str:
        assert code == "one-time-code"
        return "signed-session"
    monkeypatch.setattr("app.api.v1.auth.NativeOAuthService.consume", consume)
    with make_test_client() as client:
        response = client.post("/api/auth/native/exchange", json={"code": "one-time-code"})
    assert response.status_code == 204
    assert "signed-session" in response.headers["set-cookie"]


def test_native_apple_login_sets_session_cookie(monkeypatch: MonkeyPatch) -> None:
    async def complete(self: object, code: str, identity_token: str, nonce: str, display_name: str) -> OAuthCompletion:
        assert (code, identity_token, nonce) == ("apple-code", "apple-token", "1234567890abcdef")
        assert display_name == "애플 사용자"
        return OAuthCompletion(session_token="apple-session", user_id=uuid4())
    monkeypatch.setattr("app.api.v1.auth.OAuthService.complete_native_apple", complete)
    payload = {"authorization_code": "apple-code", "identity_token": "apple-token", "nonce": "1234567890abcdef", "display_name": "애플 사용자"}
    with make_test_client() as client:
        response = client.post("/api/auth/apple/native", json=payload)
    assert response.status_code == 204
    assert "apple-session" in response.headers["set-cookie"]


def test_native_apple_login_rejects_short_nonce() -> None:
    payload = {"authorization_code": "apple-code", "identity_token": "apple-token", "nonce": "short"}
    with make_test_client() as client:
        response = client.post("/api/auth/apple/native", json=payload)
    assert response.status_code == 422


def test_apple_notification_endpoint_accepts_payload(monkeypatch: MonkeyPatch) -> None:
    received: list[str] = []
    async def process(self: object, payload: str) -> None:
        received.append(payload)
    monkeypatch.setattr("app.api.v1.auth.AppleNotificationService.process", process)
    with make_test_client() as client:
        response = client.post("/api/auth/apple/notifications", json={"payload": "signed-payload"})
    assert response.status_code == 204
    assert received == ["signed-payload"]


def test_google_callback_redirects_oauth_error_to_frontend(monkeypatch: MonkeyPatch) -> None:
    async def complete(self: object, provider: UserProvider, code: str, state: str) -> OAuthCompletion:
        raise BadRequestError("OAuth token exchange failed")
    monkeypatch.setattr("app.api.v1.auth.OAuthService.complete", complete)
    with make_test_client() as client:
        response = client.get("/api/auth/google/callback?code=code&state=state", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "http://localhost:5173?error=BAD_REQUEST&error_description=OAuth+token+exchange+failed"
    assert "alive_session" not in response.headers.get("set-cookie", "")


def test_google_callback_redirects_unexpected_oauth_error_to_frontend(monkeypatch: MonkeyPatch) -> None:
    async def complete(self: object, provider: UserProvider, code: str, state: str) -> OAuthCompletion:
        raise RuntimeError("jwks unavailable")
    monkeypatch.setattr("app.api.v1.auth.OAuthService.complete", complete)
    with make_test_client() as client:
        response = client.get("/api/auth/google/callback?code=code&state=state", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "http://localhost:5173?error=INTERNAL_SERVER_ERROR&error_description=OAuth+login+failed"
    assert "alive_session" not in response.headers.get("set-cookie", "")


def test_apple_callback_sets_session_cookie(monkeypatch) -> None:
    async def complete(self: object, provider: UserProvider, code: str, state: str) -> OAuthCompletion:
        assert provider == UserProvider.apple
        assert code == "code"
        assert state == "state"
        return OAuthCompletion(session_token="signed-session", user_id=uuid4())

    monkeypatch.setattr("app.api.v1.auth.OAuthService.complete", complete)
    with make_test_client() as client:
        response = client.post("/api/auth/apple/callback", data={"code": "code", "state": "state"}, follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "http://localhost:5173"
    assert "signed-session" in response.headers["set-cookie"]


def test_apple_callback_redirects_oauth_error_to_frontend(monkeypatch: MonkeyPatch) -> None:
    async def complete(self: object, provider: UserProvider, code: str, state: str) -> OAuthCompletion:
        raise BadRequestError("Invalid OAuth state")
    monkeypatch.setattr("app.api.v1.auth.OAuthService.complete", complete)
    with make_test_client() as client:
        response = client.post("/api/auth/apple/callback", data={"code": "code", "state": "state"}, follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "http://localhost:5173?error=BAD_REQUEST&error_description=Invalid+OAuth+state"
    assert "alive_session" not in response.headers.get("set-cookie", "")


def test_oauth_jwt_verification_uses_clock_skew_leeway(monkeypatch: MonkeyPatch) -> None:
    class StubJWKClient:
        def __init__(self, url: str) -> None:
            self.url = url
        def get_signing_key_from_jwt(self, token: str) -> object:
            return SimpleNamespace(key="public-key")
    def decode(token: str, key: object, algorithms: list[str], audience: str, issuer: str, leeway: int) -> dict[str, object]:
        assert leeway == 45
        return {"sub": "subject", "email": "tester@example.com"}
    monkeypatch.setattr("app.services.oauth.PyJWKClient", StubJWKClient)
    monkeypatch.setattr("app.services.oauth.jwt.decode", decode)
    service = OAuthService(Settings(oauth_jwt_leeway_seconds=45), StubSession())
    claims = service._verify_jwt("token", "audience", "issuer", "https://jwks.example")
    assert claims["sub"] == "subject"


def test_oauth_jwt_verification_errors_become_bad_request(monkeypatch: MonkeyPatch) -> None:
    class StubJWKClient:
        def __init__(self, url: str) -> None:
            self.url = url
        def get_signing_key_from_jwt(self, token: str) -> object:
            return SimpleNamespace(key="public-key")
    def decode(token: str, key: object, algorithms: list[str], audience: str, issuer: str, leeway: int) -> dict[str, object]:
        raise ImmatureSignatureError("The token is not yet valid (iat)")
    monkeypatch.setattr("app.services.oauth.PyJWKClient", StubJWKClient)
    monkeypatch.setattr("app.services.oauth.jwt.decode", decode)
    service = OAuthService(Settings(), StubSession())
    with raises(BadRequestError, match="OAuth identity verification failed"):
        service._verify_jwt("token", "audience", "issuer", "https://jwks.example")


def test_oauth_jwks_fetch_errors_become_bad_request(monkeypatch: MonkeyPatch) -> None:
    class StubJWKClient:
        def __init__(self, url: str) -> None:
            self.url = url
        def get_signing_key_from_jwt(self, token: str) -> object:
            raise PyJWKClientError("jwks unavailable")
    monkeypatch.setattr("app.services.oauth.PyJWKClient", StubJWKClient)
    service = OAuthService(Settings(), StubSession())
    with raises(BadRequestError, match="OAuth identity verification failed"):
        service._verify_jwt("token", "audience", "issuer", "https://jwks.example")


def test_native_apple_nonce_must_match_identity_claim() -> None:
    service = OAuthService(Settings(), StubSession())
    service._require_apple_nonce({"nonce": "1234567890abcdef"}, "1234567890abcdef")
    with raises(BadRequestError, match="Apple identity verification failed"):
        service._require_apple_nonce({"nonce": "other"}, "1234567890abcdef")


def test_native_apple_login_verifies_device_and_server_identity(monkeypatch: MonkeyPatch) -> None:
    service = OAuthService(Settings(apple_native_client_id="com.ashwoodfriends.alive"), StubSession())
    claims = {"device-token": {"sub": "apple-user", "email": "private@privaterelay.appleid.com", "nonce": "1234567890abcdef"}, "server-token": {"sub": "apple-user"}}
    async def exchange(code: str) -> dict[str, object]:
        assert code == "single-use-code"
        return {"id_token": "server-token", "refresh_token": "refresh", "access_token": "access", "expires_in": 3600}
    async def complete(identity: object, tokens: object, client_id: str) -> OAuthCompletion:
        assert getattr(identity, "display_name") == "애플 사용자"
        assert getattr(identity, "email") == "private@privaterelay.appleid.com"
        assert getattr(tokens, "refresh_token") == "refresh"
        assert client_id == "com.ashwoodfriends.alive"
        return OAuthCompletion(session_token="session", user_id=uuid4())
    monkeypatch.setattr(service, "_verify_apple_native_token", lambda token: claims[token])
    monkeypatch.setattr(service, "_exchange_native_apple_code", exchange)
    monkeypatch.setattr(service, "_complete_identity", complete)
    result = asyncio.run(service.complete_native_apple("single-use-code", "device-token", "1234567890abcdef", "애플 사용자"))
    assert result.session_token == "session"


def test_native_apple_login_accepts_verified_identity_without_email(monkeypatch: MonkeyPatch) -> None:
    service = OAuthService(Settings(apple_native_client_id="com.ashwoodfriends.alive"), StubSession())
    claims = {"device-token": {"sub": "apple-user", "nonce": "1234567890abcdef"}, "server-token": {"sub": "apple-user"}}
    async def exchange(code: str) -> dict[str, object]:
        return {"id_token": "server-token", "refresh_token": "refresh", "access_token": "access", "expires_in": 3600}
    async def complete(identity: object, tokens: object, client_id: str) -> OAuthCompletion:
        assert getattr(identity, "subject") == "apple-user"
        assert getattr(identity, "email").endswith("@apple-login.ashwoodfriends.com")
        assert len(getattr(identity, "email").split("@")[0]) <= 64
        return OAuthCompletion(session_token="session", user_id=uuid4())
    monkeypatch.setattr(service, "_verify_apple_native_token", lambda token: claims[token])
    monkeypatch.setattr(service, "_exchange_native_apple_code", exchange)
    monkeypatch.setattr(service, "_complete_identity", complete)
    result = asyncio.run(service.complete_native_apple("single-use-code", "device-token", "1234567890abcdef", ""))
    assert result.session_token == "session"


def test_native_apple_login_repairs_legacy_fallback_email() -> None:
    legacy_email = f"apple-{'a' * 64}@apple-login.ashwoodfriends.com"
    replacement_email = f"apple-{'a' * 58}@apple-login.ashwoodfriends.com"
    user = StubUser(uuid4(), legacy_email, UserProvider.apple, StubProfile())
    service = OAuthService(Settings(), StubSession())
    async def get_user(email: str, provider: UserProvider, subject: str, display_name: str, deletion_fingerprint: str = "") -> StubUser:
        return user
    service.users = SimpleNamespace(get_or_create_provider_user=get_user)
    identity = ProviderIdentity(UserProvider.apple, "apple-user", replacement_email, "Apple 사용자")
    asyncio.run(service._complete_identity(identity))
    assert user.email == replacement_email
    assert str(UserResponse.model_validate(user).email) == replacement_email


def test_native_apple_login_rejects_mismatched_server_user() -> None:
    service = OAuthService(Settings(), StubSession())
    with raises(BadRequestError, match="Apple identity verification failed"):
        service._require_same_apple_user({"sub": "first"}, {"sub": "second"})


def test_native_apple_login_requires_server_identity_token() -> None:
    service = OAuthService(Settings(), StubSession())
    with raises(BadRequestError, match="Apple token exchange failed"):
        service._required_id_token({})


def test_native_apple_login_logs_safe_failure_stage(monkeypatch: MonkeyPatch, caplog: LogCaptureFixture) -> None:
    service = OAuthService(Settings(), StubSession())
    async def exchange(code: str) -> dict[str, object]:
        raise BadRequestError("OAuth token exchange failed: invalid_grant")
    monkeypatch.setattr(service, "_verify_apple_native_token", lambda token: {"sub": "apple-user", "nonce": "1234567890abcdef"})
    monkeypatch.setattr(service, "_exchange_native_apple_code", exchange)
    with caplog.at_level("WARNING", logger="app.services.oauth"):
        with raises(BadRequestError, match="invalid_grant"):
            asyncio.run(service.complete_native_apple("single-use-code", "device-token", "1234567890abcdef", "사용자"))
    assert caplog.messages == ["Native Apple login failed stage=token_exchange error=OAuth token exchange failed: invalid_grant"]
    assert "single-use-code" not in caplog.text
    assert "device-token" not in caplog.text
    assert "사용자" not in caplog.text


def test_native_apple_tokens_are_encrypted_before_storage() -> None:
    stored: dict[str, object] = {}
    class StubCredentials:
        async def upsert(self, user_id: object, client_id: str, subject: str, refresh_token: str, access_token: str, expires_at: object) -> None:
            stored.update({"client_id": client_id, "refresh": refresh_token, "access": access_token})
    settings = Settings(oauth_token_encryption_key=Fernet.generate_key().decode())
    service = OAuthService(settings, StubSession())
    service.apple_credentials = StubCredentials()
    tokens = service._apple_tokens({"refresh_token": "refresh", "access_token": "access", "expires_in": 3600})
    asyncio.run(service._store_apple_credentials(uuid4(), "client", "subject", tokens))
    assert stored["client_id"] == "client"
    assert "refresh" not in str(stored["refresh"]).removeprefix("v1:")
    assert "access" not in str(stored["access"]).removeprefix("v1:")


def test_oauth_token_exchange_rejects_provider_server_errors(monkeypatch: MonkeyPatch) -> None:
    class StubClient:
        async def __aenter__(self) -> "StubClient":
            return self
        async def __aexit__(self, exc_type: object, exc: object, traceback: object) -> None:
            return None
        async def post(self, url: str, data: dict[str, str]) -> object:
            return SimpleNamespace(status_code=503, json=lambda: {})
    monkeypatch.setattr("app.services.oauth.httpx.AsyncClient", lambda timeout: StubClient())
    service = OAuthService(Settings(), StubSession())
    with raises(ServiceUnavailableError, match="OAuth provider is temporarily unavailable"):
        asyncio.run(service._post_token("https://provider.example/token", {"code": "secret"}))


def test_oauth_token_exchange_preserves_safe_provider_error_code(monkeypatch: MonkeyPatch) -> None:
    class StubClient:
        async def __aenter__(self) -> "StubClient":
            return self
        async def __aexit__(self, exc_type: object, exc: object, traceback: object) -> None:
            return None
        async def post(self, url: str, data: dict[str, str]) -> object:
            return SimpleNamespace(status_code=400, json=lambda: {"error": "invalid_client", "error_description": "secret detail"})
    monkeypatch.setattr("app.services.oauth.httpx.AsyncClient", lambda timeout: StubClient())
    service = OAuthService(Settings(), StubSession())
    with raises(BadRequestError, match=r"OAuth token exchange failed: invalid_client$"):
        asyncio.run(service._post_token("https://provider.example/token", {"code": "secret"}))


def make_test_client() -> TestClient:
    app.dependency_overrides[get_settings] = stub_settings
    app.dependency_overrides[get_db_session] = stub_db_session
    app.dependency_overrides[get_current_user] = stub_current_user
    return TestClient(app)


def make_test_client_without_auth_override() -> TestClient:
    app.dependency_overrides[get_settings] = stub_settings
    app.dependency_overrides[get_db_session] = stub_db_session
    app.dependency_overrides.pop(get_current_user, None)
    return TestClient(app)


def make_test_client_with_profileless_user() -> TestClient:
    app.dependency_overrides[get_settings] = stub_settings
    app.dependency_overrides[get_db_session] = stub_db_session
    app.dependency_overrides[get_current_user] = stub_current_user_without_profile
    return TestClient(app)


def make_test_client_with_failing_auth() -> TestClient:
    async def fail_current_user() -> None:
        raise RuntimeError("boom")
    app.dependency_overrides[get_settings] = stub_settings
    app.dependency_overrides[get_db_session] = stub_db_session
    app.dependency_overrides[get_current_user] = fail_current_user
    return TestClient(app, raise_server_exceptions=False)


def stub_settings() -> Settings:
    return Settings(
        auth_secret_key="test-secret",
        frontend_origins="http://localhost:5173,http://192.168.0.2:5173",
        google_client_id="google-client",
        google_client_secret="google-secret",
        apple_client_id="apple-client",
        apple_client_secret="apple-secret",
        apple_native_client_id="com.ashwoodfriends.alive",
        apple_native_client_secret="apple-native-secret",
    )
