from collections.abc import AsyncIterator
from dataclasses import dataclass
from types import SimpleNamespace
from typing import Optional
from urllib.parse import parse_qs, urlsplit
from uuid import uuid4

from fastapi import Response
from fastapi.testclient import TestClient
from jwt.exceptions import ImmatureSignatureError, PyJWKClientError
from pytest import MonkeyPatch, raises

from app.api.deps import get_current_user
from app.core.config import Settings, get_settings
from app.core.errors import BadRequestError
from app.core.security import _signature, read_oauth_state, sign_oauth_state
from app.db.session import get_db_session
from app.main import app
from app.models import UserProvider
from app.services.oauth import OAuthService


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


def test_logout_clears_session_cookie() -> None:
    with make_test_client() as client:
        response = client.post("/api/auth/logout")
    assert response.status_code == 204
    assert "alive_session" in response.headers.get("set-cookie", "")


def test_google_callback_sets_session_cookie(monkeypatch) -> None:
    async def complete(self: object, provider: UserProvider, code: str, state: str) -> str:
        assert provider == UserProvider.google
        assert code == "code"
        assert state == "state"
        return "signed-session"

    monkeypatch.setattr("app.api.v1.auth.OAuthService.complete", complete)
    with make_test_client() as client:
        response = client.get("/api/auth/google/callback?code=code&state=state", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "http://localhost:5173"
    assert "signed-session" in response.headers["set-cookie"]


def test_google_callback_uses_state_return_url(monkeypatch: MonkeyPatch) -> None:
    async def complete(self: object, provider: UserProvider, code: str, state: str) -> str:
        return "signed-session"
    state = sign_oauth_state("google", 60, "test-secret", "http://192.168.0.2:5173/api/auth/google/callback", "http://192.168.0.2:5173")
    monkeypatch.setattr("app.api.v1.auth.OAuthService.complete", complete)
    with make_test_client() as client:
        response = client.get("/api/auth/google/callback", params={"code": "code", "state": state}, follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "http://192.168.0.2:5173"
    assert "signed-session" in response.headers["set-cookie"]


def test_google_callback_redirects_oauth_error_to_frontend(monkeypatch: MonkeyPatch) -> None:
    async def complete(self: object, provider: UserProvider, code: str, state: str) -> str:
        raise BadRequestError("OAuth token exchange failed")
    monkeypatch.setattr("app.api.v1.auth.OAuthService.complete", complete)
    with make_test_client() as client:
        response = client.get("/api/auth/google/callback?code=code&state=state", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "http://localhost:5173?error=BAD_REQUEST&error_description=OAuth+token+exchange+failed"
    assert "alive_session" not in response.headers.get("set-cookie", "")


def test_google_callback_redirects_unexpected_oauth_error_to_frontend(monkeypatch: MonkeyPatch) -> None:
    async def complete(self: object, provider: UserProvider, code: str, state: str) -> str:
        raise RuntimeError("jwks unavailable")
    monkeypatch.setattr("app.api.v1.auth.OAuthService.complete", complete)
    with make_test_client() as client:
        response = client.get("/api/auth/google/callback?code=code&state=state", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "http://localhost:5173?error=INTERNAL_SERVER_ERROR&error_description=OAuth+login+failed"
    assert "alive_session" not in response.headers.get("set-cookie", "")


def test_apple_callback_sets_session_cookie(monkeypatch) -> None:
    async def complete(self: object, provider: UserProvider, code: str, state: str) -> str:
        assert provider == UserProvider.apple
        assert code == "code"
        assert state == "state"
        return "signed-session"

    monkeypatch.setattr("app.api.v1.auth.OAuthService.complete", complete)
    with make_test_client() as client:
        response = client.post("/api/auth/apple/callback", data={"code": "code", "state": "state"}, follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "http://localhost:5173"
    assert "signed-session" in response.headers["set-cookie"]


def test_apple_callback_redirects_oauth_error_to_frontend(monkeypatch: MonkeyPatch) -> None:
    async def complete(self: object, provider: UserProvider, code: str, state: str) -> str:
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
    )
