from __future__ import annotations

import asyncio

import httpx
import pytest

from app.core.config import Settings
from app.core.errors import BadRequestError, ServiceUnavailableError
from app.services.toss_api import TossApiClient
from app.services.toss_login import TOSS_LOGIN_ME_PATH, TOSS_LOGIN_TOKEN_PATH, TossLoginService


class StubClient:
    def __init__(self, response: httpx.Response) -> None:
        self.response = response
        self.calls: list[tuple[str, str, object, dict[str, str]]] = []

    async def __aenter__(self) -> StubClient:
        return self

    async def __aexit__(self, exc_type: object, exc: object, traceback: object) -> None:
        return None

    async def request(self, method: str, url: str, headers: dict[str, str], json: object | None = None) -> httpx.Response:
        self.calls.append((method, url, json, headers))
        return self.response


class StubApi:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str, object]] = []

    async def post(self, path: str, payload: dict[str, object]) -> dict[str, object]:
        self.calls.append(("POST", path, payload))
        return {"accessToken": "access-token"}

    async def get(self, path: str, headers: dict[str, str]) -> dict[str, object]:
        self.calls.append(("GET", path, headers))
        return {"userKey": 123}


def test_toss_api_unwraps_success_and_preserves_headers(monkeypatch: pytest.MonkeyPatch) -> None:
    client = StubClient(httpx.Response(200, json={"resultType": "SUCCESS", "success": {"orderId": "order-1"}}))
    api = TossApiClient(Settings(_env_file=None))
    monkeypatch.setattr(api, "_client", lambda: client)
    result = asyncio.run(api.post("/orders", {"orderId": "order-1"}, {"x-toss-user-key": "123"}))
    asyncio.run(api.get("/me", {"Authorization": "Bearer token"}))
    assert result == {"orderId": "order-1"}
    assert client.calls[0][2:] == ({"orderId": "order-1"}, {"x-toss-user-key": "123"})
    assert client.calls[1][2:] == (None, {"Authorization": "Bearer token"})


@pytest.mark.parametrize("status,error", [(500, ServiceUnavailableError), (400, BadRequestError)])
def test_toss_api_maps_http_failures(monkeypatch: pytest.MonkeyPatch, status: int, error: type[Exception]) -> None:
    api = TossApiClient(Settings(_env_file=None))
    monkeypatch.setattr(api, "_client", lambda: StubClient(httpx.Response(status, json={})))
    with pytest.raises(error):
        asyncio.run(api.post("/orders", {"orderId": "order-1"}))


def test_toss_login_uses_shared_api_contract() -> None:
    service = TossLoginService(Settings(_env_file=None), object())  # type: ignore[arg-type]
    api = StubApi()
    service.api = api  # type: ignore[assignment]
    token = asyncio.run(service._access_token("code", "referrer"))
    user_key = asyncio.run(service._user_key(token))
    assert (token, user_key) == ("access-token", 123)
    assert api.calls == [("POST", TOSS_LOGIN_TOKEN_PATH, {"authorizationCode": "code", "referrer": "referrer"}), ("GET", TOSS_LOGIN_ME_PATH, {"Authorization": "Bearer access-token"})]
