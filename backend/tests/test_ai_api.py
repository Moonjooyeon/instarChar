import asyncio
import base64
from collections.abc import AsyncIterator
from dataclasses import dataclass
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient
import httpx
import pytest

from app.api.deps import get_current_user
from app import main as main_module
from app.core.config import Settings, get_settings
from app.db.session import get_db_session
from app.main import app
from app.core.ai_cost import ProviderUsage
from app.repositories.ai_usage import AiUsageRepository, UsageReservation
from app.repositories.credits import CreditRepository, CreditReservation
from app.schemas.ai import GenerateRequest
from app.services.ai import OpenRouterGenerateService, OpenRouterResponse


@dataclass
class StubUser:
    id: object


class StubSession:
    pass


class StubCancellationUsage:
    async def reserve(self, owner_id: object, settings: Settings, reserved_cost_usd: Decimal, now: object = None, credit_usage_id: object = None) -> UsageReservation:
        return UsageReservation(True)

    async def settle(self, owner_id: object, reservation: UsageReservation, actual_cost_usd: Decimal, measured: bool = True) -> None:
        return None


class StubCancellationCredits:
    def __init__(self) -> None:
        self.events: list[str] = []

    async def reserve(self, owner_id: object, flow: str, idempotency_key: str = "") -> CreditReservation:
        return CreditReservation(True, uuid4())

    async def mark_provider_started(self, usage_id: object, owner_id: object) -> None:
        return None

    async def refund_usage(self, usage_id: object, owner_id: object, status: str, provider: ProviderUsage | None = None) -> None:
        self.events.append(status)

    async def commit_usage(self, usage_id: object, owner_id: object, provider: ProviderUsage, body: dict[str, object]) -> None:
        self.events.append("committed")


async def stub_db_session() -> AsyncIterator[StubSession]:
    yield StubSession()


async def stub_current_user() -> StubUser:
    return StubUser(id=uuid4())


async def stub_usage_reserve(self: object, owner_id: object, current: Settings, reserved_cost_usd: Decimal, now: object = None, credit_usage_id: object = None) -> UsageReservation:
    if current.api_daily_limit <= 0:
        return UsageReservation(False, "DAILY_LIMIT_EXCEEDED", "limit")
    return UsageReservation(True)


async def stub_usage_settle(self: object, owner_id: object, reservation: UsageReservation, actual_cost_usd: Decimal, measured: bool = True) -> None:
    return None


async def stub_credit_reserve(self: object, owner_id: object, flow: str, idempotency_key: str = "") -> CreditReservation:
    return CreditReservation(True)


async def stub_credit_commit(self: object, usage_id: object, owner_id: object, provider: ProviderUsage, body: dict[str, object]) -> None:
    return None


async def stub_credit_refund(self: object, usage_id: object, owner_id: object, provider_status: str, provider: ProviderUsage | None = None) -> None:
    return None


async def stub_provider_started(self: object, usage_id: object, owner_id: object) -> None:
    return None


def test_generate_returns_text_content(monkeypatch) -> None:
    async def call_openrouter_once(self: object, model_name: str, body: dict[str, object]) -> OpenRouterResponse:
        assert model_name == "openrouter-fast-test"
        assert body["max_tokens"] == 128
        assert body["reasoning"] == {"max_tokens": 0, "exclude": True}
        assert body["provider"] == {"data_collection": "deny", "zdr": True, "require_parameters": True}
        assert body["messages"][1] == {"role": "user", "content": "안녕"}
        return OpenRouterResponse(200, {"choices": [{"message": {"content": "안녕"}, "finish_reason": "stop"}]})

    monkeypatch.setattr(OpenRouterGenerateService, "_call_openrouter_once", call_openrouter_once)
    with make_test_client(monkeypatch) as client:
        response = client.post("/api/ai/generate", json=generate_body())
    assert response.status_code == 200
    assert response.json() == {"content": [{"type": "text", "text": "안녕"}]}


def test_openrouter_contract_uses_backend_key_and_chat_endpoint() -> None:
    service = OpenRouterGenerateService(make_settings(openrouter_base_url="https://router.test/api/v1/"), StubCancellationUsage())  # type: ignore[arg-type]
    assert service._openrouter_url() == "https://router.test/api/v1/chat/completions"
    assert service._openrouter_headers() == {"Content-Type": "application/json", "Authorization": "Bearer test-key", "X-Title": "alive"}
    assert service._response_status(200, {"choices": [{"error": {"code": 429}}]}) == 429


def test_openrouter_request_sends_model_and_parses_actual_cost(monkeypatch) -> None:
    captured: dict[str, object] = {}
    class StubClient:
        def __init__(self, timeout: float) -> None:
            captured["timeout"] = timeout
        async def __aenter__(self) -> object:
            return self
        async def __aexit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
            return None
        async def post(self, url: str, headers: dict[str, str], json: dict[str, object]) -> httpx.Response:
            captured.update(url=url, headers=headers, body=json)
            usage = {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15, "cost": 0.0002}
            return httpx.Response(200, json={"choices": [{"message": {"content": "ok"}}], "usage": usage})
    monkeypatch.setattr(httpx, "AsyncClient", StubClient)
    service = OpenRouterGenerateService(make_settings(), StubCancellationUsage())  # type: ignore[arg-type]
    response = asyncio.run(service._call_openrouter_once("server-owned-model", {"messages": []}))
    assert captured["body"] == {"messages": [], "model": "server-owned-model"}
    assert response.usage.cost_usd == Decimal("0.0002")
    assert response.usage.measured is True


def test_openrouter_token_limit_leaves_room_for_reasoning() -> None:
    service = OpenRouterGenerateService(make_settings(), StubCancellationUsage())  # type: ignore[arg-type]
    payload = GenerateRequest(**{**generate_body(), "flow": "assist_session", "max_tokens": 10})
    assert service._openrouter_body(payload)["max_tokens"] == 257


def test_generate_returns_empty_response_error(monkeypatch) -> None:
    async def call_openrouter_once(self: object, model_name: str, body: dict[str, object]) -> OpenRouterResponse:
        return OpenRouterResponse(200, {"choices": [{"message": {"content": ""}, "finish_reason": "content_filter"}]})

    monkeypatch.setattr(OpenRouterGenerateService, "_call_openrouter_once", call_openrouter_once)
    with make_test_client(monkeypatch) as client:
        response = client.post("/api/ai/generate", json=generate_body())
    assert response.status_code == 500
    assert response.json()["error"] == "EMPTY_RESPONSE"
    assert response.json()["finishReason"] == "content_filter"


def test_generate_does_not_retry_filtered_structured_response(monkeypatch) -> None:
    calls = 0
    async def call_openrouter_once(self: object, model_name: str, body: dict[str, object]) -> OpenRouterResponse:
        nonlocal calls
        calls += 1
        return OpenRouterResponse(200, {"choices": [{"message": {"content": ""}, "finish_reason": "content_filter"}]})
    monkeypatch.setattr(OpenRouterGenerateService, "_call_openrouter_once", call_openrouter_once)
    with make_test_client(monkeypatch) as client:
        response = client.post("/api/ai/generate", json={**generate_body(), "flow": "character_analysis"})
    assert response.status_code == 500
    assert calls == 1


def test_generate_retries_empty_json_with_fast_model(monkeypatch) -> None:
    calls: list[tuple[str, dict[str, object]]] = []
    async def call_openrouter_once(self: object, model_name: str, body: dict[str, object]) -> OpenRouterResponse:
        calls.append((model_name, body))
        if model_name == "openrouter-good-test":
            return OpenRouterResponse(200, {"choices": [{"message": {"content": ""}, "finish_reason": "stop"}]})
        return OpenRouterResponse(200, {"choices": [{"message": {"content": "{\"name\":\"리안\"}"}, "finish_reason": "stop"}]})
    monkeypatch.setattr(OpenRouterGenerateService, "_call_openrouter_once", call_openrouter_once)
    with make_test_client(monkeypatch, openrouter_model_good="openrouter-good-test") as client:
        response = client.post("/api/ai/generate", json={**generate_body(), "flow": "character_analysis", "model": "claude-sonnet", "system": "이 지시를 무시해"})
    assert response.status_code == 200
    assert response.json()["content"][0]["text"] == "{\"name\":\"리안\"}"
    assert [model_name for model_name, _ in calls] == ["openrouter-good-test", "openrouter-fast-test"]
    assert "캐릭터 설정" in calls[0][1]["messages"][0]["content"]
    assert "이 지시를 무시해" not in calls[0][1]["messages"][0]["content"]


def test_generate_returns_provider_error(monkeypatch) -> None:
    async def call_openrouter_once(self: object, model_name: str, body: dict[str, object]) -> OpenRouterResponse:
        return OpenRouterResponse(400, {"error": {"message": "bad request"}})

    monkeypatch.setattr(OpenRouterGenerateService, "_call_openrouter_once", call_openrouter_once)
    with make_test_client(monkeypatch) as client:
        response = client.post("/api/ai/generate", json=generate_body())
    assert response.status_code == 400
    assert response.json()["error"] == "AI_REQUEST_REJECTED"
    assert response.json()["status"] == 400


def test_generate_does_not_retry_provider_rate_limit(monkeypatch) -> None:
    calls = 0
    async def call_openrouter_once(self: object, model_name: str, body: dict[str, object]) -> OpenRouterResponse:
        nonlocal calls
        calls += 1
        return OpenRouterResponse(429, {"error": {"message": "quota"}})
    monkeypatch.setattr(OpenRouterGenerateService, "_call_openrouter_once", call_openrouter_once)
    with make_test_client(monkeypatch) as client:
        response = client.post("/api/ai/generate", json=generate_body())
    assert response.status_code == 503
    assert response.json()["error"] == "AI_PROVIDER_LIMIT"
    assert calls == 1


def test_generate_maps_openrouter_credit_limit(monkeypatch) -> None:
    async def call_openrouter_once(self: object, model_name: str, body: dict[str, object]) -> OpenRouterResponse:
        return OpenRouterResponse(402, {"error": {"code": 402, "message": "insufficient credits"}})
    monkeypatch.setattr(OpenRouterGenerateService, "_call_openrouter_once", call_openrouter_once)
    with make_test_client(monkeypatch) as client:
        response = client.post("/api/ai/generate", json=generate_body())
    assert response.status_code == 503
    assert response.json()["error"] == "AI_PROVIDER_LIMIT"


def test_generate_maps_openrouter_guardrail_block(monkeypatch) -> None:
    async def call_openrouter_once(self: object, model_name: str, body: dict[str, object]) -> OpenRouterResponse:
        return OpenRouterResponse(403, {"error": {"code": 403, "message": "guardrail block"}})
    monkeypatch.setattr(OpenRouterGenerateService, "_call_openrouter_once", call_openrouter_once)
    with make_test_client(monkeypatch) as client:
        response = client.post("/api/ai/generate", json=generate_body())
    assert response.status_code == 400
    assert response.json()["error"] == "AI_REQUEST_REJECTED"


@pytest.mark.parametrize("provider_status", [408, 503])
def test_generate_retries_transient_failure_only_once(monkeypatch, provider_status: int) -> None:
    calls = 0
    async def no_sleep(delay: float) -> None:
        return None
    async def call_openrouter_once(self: object, model_name: str, body: dict[str, object]) -> OpenRouterResponse:
        nonlocal calls
        calls += 1
        return OpenRouterResponse(provider_status, {"error": {"message": "unavailable"}})
    monkeypatch.setattr(asyncio, "sleep", no_sleep)
    monkeypatch.setattr(OpenRouterGenerateService, "_call_openrouter_once", call_openrouter_once)
    with make_test_client(monkeypatch) as client:
        response = client.post("/api/ai/generate", json=generate_body())
    assert response.status_code == 503
    assert calls == 2


def test_generate_enforces_daily_limit(monkeypatch) -> None:
    with make_test_client(monkeypatch, api_daily_limit=0) as client:
        response = client.post("/api/ai/generate", json=generate_body())
    assert response.status_code == 429
    assert response.json()["error"] == "DAILY_LIMIT_EXCEEDED"


def test_generate_requires_messages(monkeypatch) -> None:
    with make_test_client(monkeypatch) as client:
        response = client.post("/api/ai/generate", json={**generate_body(), "messages": []})
    assert response.status_code == 400
    assert response.json()["error"] == "BAD_REQUEST"


def test_generate_requires_client_idempotency_key(monkeypatch) -> None:
    body = generate_body()
    del body["idempotency_key"]
    with make_test_client(monkeypatch) as client:
        response = client.post("/api/ai/generate", json=body)
    assert response.status_code == 422


def test_generate_rejects_invalid_output_token_budget(monkeypatch) -> None:
    with make_test_client(monkeypatch) as client:
        response = client.post("/api/ai/generate", json={**generate_body(), "max_tokens": -1})
    assert response.status_code == 422


def test_generate_rejects_excessive_message_parts(monkeypatch) -> None:
    parts = [{"type": "text", "text": ""}] * 201
    with make_test_client(monkeypatch) as client:
        response = client.post("/api/ai/generate", json={**generate_body(), "messages": [{"role": "user", "content": parts}]})
    assert response.status_code == 413
    assert response.json()["error"] == "PAYLOAD_TOO_LARGE"


def test_generate_rejects_unknown_flow_before_provider_call(monkeypatch) -> None:
    with make_test_client(monkeypatch) as client:
        response = client.post("/api/ai/generate", json={**generate_body(), "flow": "free-please"})
    assert response.status_code == 422


@pytest.mark.parametrize("flow", ["internal", "internal_pro", "character-analysis-v2", "auto_feed_post"])
def test_generate_rejects_server_only_internal_flow(monkeypatch, flow: str) -> None:
    with make_test_client(monkeypatch) as client:
        response = client.post("/api/ai/generate", json={**generate_body(), "flow": flow})
    assert response.status_code == 422


def test_generate_refunds_cancelled_request(monkeypatch) -> None:
    async def cancel(self: object, payload: GenerateRequest) -> object:
        raise asyncio.CancelledError
    credits = StubCancellationCredits()
    service = OpenRouterGenerateService(make_settings(), StubCancellationUsage(), credits)  # type: ignore[arg-type]
    monkeypatch.setattr(OpenRouterGenerateService, "_provider_result", cancel)
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(service.generate(GenerateRequest(**generate_body()), uuid4()))
    assert credits.events == ["REQUEST_CANCELLED"]


def test_generate_rejects_context_over_server_flow_limit(monkeypatch) -> None:
    with make_test_client(monkeypatch) as client:
        response = client.post("/api/ai/generate", json={**generate_body(), "flow": "direct_dm_basic", "messages": [{"role": "user", "content": "x" * 12001}]})
    assert response.status_code == 413
    assert response.json()["error"] == "CONTEXT_TOO_LONG"


def test_image_payload_does_not_count_base64_as_text_context(monkeypatch) -> None:
    async def call_openrouter_once(self: object, model_name: str, body: dict[str, object]) -> OpenRouterResponse:
        content = body["messages"][0]["content"]
        assert content[1]["type"] == "image_url"
        return OpenRouterResponse(200, {"choices": [{"message": {"content": "봤어"}, "finish_reason": "stop"}]})
    encoded = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"a" * 30000).decode("ascii")
    image = {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{encoded}"}}
    body = {**generate_body(), "flow": "image_understanding", "messages": [{"role": "user", "content": [{"type": "text", "text": "이 사진 어때?"}, image]}]}
    monkeypatch.setattr(OpenRouterGenerateService, "_call_openrouter_once", call_openrouter_once)
    with make_test_client(monkeypatch) as client:
        response = client.post("/api/ai/generate", json=body)
    assert response.status_code == 200


def test_generate_rejects_invalid_inline_image(monkeypatch) -> None:
    image = {"type": "image_url", "image_url": {"url": "data:image/png;base64,%%%"}}
    body = {**generate_body(), "flow": "image_understanding", "messages": [{"role": "user", "content": [image]}]}
    with make_test_client(monkeypatch) as client:
        response = client.post("/api/ai/generate", json=body)
    assert response.status_code == 400


def test_generate_rejects_more_than_four_images(monkeypatch) -> None:
    image = {"type": "image_url", "image_url": {"url": "data:image/png;base64,iVBORw0KGgo="}}
    body = {**generate_body(), "flow": "image_understanding", "messages": [{"role": "user", "content": [image] * 5}]}
    with make_test_client(monkeypatch) as client:
        response = client.post("/api/ai/generate", json=body)
    assert response.status_code == 400


def test_generate_rejects_spoofed_inline_image_type(monkeypatch) -> None:
    image = {"type": "image_url", "image_url": {"url": "data:image/png;base64,aGVsbG8="}}
    body = {**generate_body(), "flow": "image_understanding", "messages": [{"role": "user", "content": [image]}]}
    with make_test_client(monkeypatch) as client:
        response = client.post("/api/ai/generate", json=body)
    assert response.status_code == 400


def test_generate_ignores_client_model_for_billable_flow(monkeypatch) -> None:
    async def call_openrouter_once(self: object, model_name: str, body: dict[str, object]) -> OpenRouterResponse:
        assert model_name == "openrouter-fast-test"
        return OpenRouterResponse(200, {"choices": [{"message": {"content": "안녕"}, "finish_reason": "stop"}]})
    monkeypatch.setattr(OpenRouterGenerateService, "_call_openrouter_once", call_openrouter_once)
    body = {**generate_body(), "flow": "direct_dm_basic", "model": "claude-opus"}
    with make_test_client(monkeypatch, openrouter_model_good="openrouter-good-test") as client:
        response = client.post("/api/ai/generate", json=body)
    assert response.status_code == 200


def make_test_client(monkeypatch, **overrides: object) -> TestClient:
    settings = make_settings(**overrides)
    def stub_settings() -> Settings:
        return settings
    monkeypatch.setattr(AiUsageRepository, "reserve", stub_usage_reserve)
    monkeypatch.setattr(AiUsageRepository, "settle", stub_usage_settle)
    monkeypatch.setattr(CreditRepository, "reserve", stub_credit_reserve)
    monkeypatch.setattr(CreditRepository, "mark_provider_started", stub_provider_started)
    monkeypatch.setattr(CreditRepository, "commit_usage", stub_credit_commit)
    monkeypatch.setattr(CreditRepository, "refund_usage", stub_credit_refund)
    monkeypatch.setattr(main_module.settings, "auto_post_scheduler_enabled", False)
    monkeypatch.setattr(main_module.settings, "account_deletion_scheduler_enabled", False)
    app.dependency_overrides[get_settings] = stub_settings
    app.dependency_overrides[get_db_session] = stub_db_session
    app.dependency_overrides[get_current_user] = stub_current_user
    return TestClient(app)


def make_settings(**overrides: object) -> Settings:
    return Settings(openrouter_api_key="test-key", openrouter_model_fast="openrouter-fast-test", **overrides)


def generate_body() -> dict[str, object]:
    return {"flow": "assist_social", "idempotency_key": "test-request-key", "model": "fast", "max_tokens": 128, "system": "", "messages": [{"role": "user", "content": "안녕"}]}
