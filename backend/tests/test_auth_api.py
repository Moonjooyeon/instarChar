from collections.abc import AsyncIterator
from dataclasses import dataclass
from uuid import uuid4

from fastapi import Response
from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.core.config import Settings, get_settings
from app.db.session import get_db_session
from app.main import app
from app.models import UserProvider


@dataclass
class StubProfile:
    display_name: str = "테스터"
    onboarded: bool = True


@dataclass
class StubUser:
    id: object
    email: str
    provider: UserProvider
    profile: StubProfile


class StubSession:
    async def commit(self) -> None:
        return None


async def stub_db_session() -> AsyncIterator[StubSession]:
    yield StubSession()


async def stub_current_user() -> StubUser:
    return StubUser(id=uuid4(), email="tester@example.com", provider=UserProvider.google, profile=StubProfile())


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
    assert response.headers["location"] == "/app"
    assert "signed-session" in response.headers["set-cookie"]


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
    assert response.headers["location"] == "/app"
    assert "signed-session" in response.headers["set-cookie"]


def make_test_client() -> TestClient:
    app.dependency_overrides[get_settings] = stub_settings
    app.dependency_overrides[get_db_session] = stub_db_session
    app.dependency_overrides[get_current_user] = stub_current_user
    return TestClient(app)


def stub_settings() -> Settings:
    return Settings(
        auth_secret_key="test-secret",
        google_client_id="google-client",
        google_client_secret="google-secret",
        apple_client_id="apple-client",
        apple_client_secret="apple-secret",
    )
