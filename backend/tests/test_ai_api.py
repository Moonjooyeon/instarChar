import asyncio
import base64
from collections.abc import AsyncIterator
from dataclasses import dataclass
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient
import httpx
import pytest

from app import main as main_module
from app.api.deps import get_current_user
from app.core.ai_cost import ProviderUsage
from app.core.config import Settings, get_settings
from app.core.credit_policy import resolve_flow
from app.db.session import get_db_session
from app.main import app
from app.repositories.ai_usage import AiUsageRepository, UsageReservation
from app.repositories.credits import CreditRepository, CreditReservation
from app.schemas.ai import GenerateRequest
from app.services.ai import MonoGptGeminiGenerateService, MonoGptGeminiResponse


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


def gemini_response(text: str, finish_reason: str = "STOP", usage: dict[str, object] | None = None) -> dict[str, object]:
    metadata = usage or {"promptTokenCount": 10, "candidatesTokenCount": 5, "totalTokenCount": 15}
    return {"candidates": [{"content": {"parts": [{"text": text}]}, "finishReason": finish_reason}], "usageMetadata": metadata}


def test_generate_uses_gemini_native_contract(monkeypatch: pytest.MonkeyPatch) -> None:
    async def call_gemini_once(self: object, model_name: str, body: dict[str, object]) -> MonoGptGeminiResponse:
        assert model_name == "gemini-fast-test"
        assert body == {"contents": [{"role": "user", "parts": [{"text": "안녕"}]}], "generationConfig": {"maxOutputTokens": 128, "temperature": 0.9, "thinkingConfig": {"thinkingBudget": 0}}}
        return MonoGptGeminiResponse(200, gemini_response("안녕"))
    monkeypatch.setattr(MonoGptGeminiGenerateService, "_call_gemini_once", call_gemini_once)
    with make_test_client(monkeypatch) as client:
        response = client.post("/api/ai/generate", json={**generate_body(), "flow": "direct_dm_basic"})
    assert response.status_code == 200
    assert response.json() == {"content": [{"type": "text", "text": "안녕"}]}


def test_gemini_contract_uses_native_url_and_header() -> None:
    service = MonoGptGeminiGenerateService(make_settings(monogpt_gemini_base_url="https://router.test/api/monorouter/v1/gemini/"), StubCancellationUsage())  # type: ignore[arg-type]
    assert service._gemini_url("gemini-3.6-flash") == "https://router.test/api/monorouter/v1/gemini/v1beta/models/gemini-3.6-flash:generateContent"
    assert service._gemini_headers() == {"Content-Type": "application/json", "x-goog-api-key": "test-key"}
    assert service._response_status(200, {"error": {"code": 429}}) == 429


def test_gemini_request_parses_native_usage(monkeypatch: pytest.MonkeyPatch) -> None:
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
            return httpx.Response(200, json=gemini_response("ok", usage={"promptTokenCount": 10, "candidatesTokenCount": 5, "thoughtsTokenCount": 2, "totalTokenCount": 15}))
    monkeypatch.setattr(httpx, "AsyncClient", StubClient)
    service = MonoGptGeminiGenerateService(make_settings(), StubCancellationUsage())  # type: ignore[arg-type]
    response = asyncio.run(service._call_gemini_once("server-owned-model", {"contents": []}))
    assert captured["body"] == {"contents": []}
    assert captured["headers"] == {"Content-Type": "application/json", "x-goog-api-key": "test-key"}
    assert captured["url"] == "https://router.test/api/monorouter/v1/gemini/v1beta/models/server-owned-model:generateContent"
    assert response.usage == ProviderUsage(attempts=1, input_tokens=10, output_tokens=5, thought_tokens=2, total_tokens=15)


def test_generation_config_uses_policy_thinking_budget() -> None:
    service = MonoGptGeminiGenerateService(make_settings(), StubCancellationUsage())  # type: ignore[arg-type]
    for flow in ("feed_post", "direct_dm_context", "character_analysis"):
        payload = GenerateRequest(**{**generate_body(), "flow": flow})
        assert service._generation_config(payload, flow == "character_analysis")["thinkingConfig"] == {"thinkingBudget": resolve_flow(flow).thinking_budget}


def test_feed_generation_uses_a_higher_temperature_without_losing_json_mode() -> None:
    service = MonoGptGeminiGenerateService(make_settings(), StubCancellationUsage())  # type: ignore[arg-type]
    payload = GenerateRequest(**{**generate_body(), "flow": "feed_post"})
    config = service._generation_config(payload, True)
    assert config["temperature"] == 0.75
    assert config["responseMimeType"] == "application/json"


@pytest.mark.parametrize(("flow", "credits", "model", "max_input_chars", "max_output_tokens", "thinking_budget"), [
    ("direct_dm_basic", 1, "flash-tier", 12000, 512, 0),
    ("direct_dm_context", 2, "flash-tier", 24000, 768, 256),
    ("direct_dm_pro", 5, "pro-tier", 24000, 1536, 256),
])
def test_each_dm_response_tier_keeps_its_server_owned_cost_and_generation_limits(
    flow: str,
    credits: int,
    model: str,
    max_input_chars: int,
    max_output_tokens: int,
    thinking_budget: int,
) -> None:
    service = MonoGptGeminiGenerateService(make_settings(monogpt_gemini_model_fast="flash-tier", monogpt_gemini_model_good="pro-tier"), StubCancellationUsage())  # type: ignore[arg-type]
    payload = GenerateRequest(**{**generate_body(), "flow": flow, "max_tokens": 4096})
    policy = resolve_flow(flow)
    config = service._generation_config(payload, False)
    assert (policy.credits, policy.max_input_chars) == (credits, max_input_chars)
    assert service._model_name(flow) == model
    assert config == {"maxOutputTokens": max_output_tokens, "temperature": 0.9, "thinkingConfig": {"thinkingBudget": thinking_budget}}
    too_long = GenerateRequest(**{**generate_body(), "flow": flow, "messages": [{"role": "user", "content": "x" * (max_input_chars + 1)}]})
    error = service._request_error(too_long)
    assert error is not None
    assert error.body["error"] == "CONTEXT_TOO_LONG"


def test_empty_dm_retry_keeps_the_selected_tier_output_limit() -> None:
    service = MonoGptGeminiGenerateService(make_settings(), StubCancellationUsage())  # type: ignore[arg-type]
    assert service._retry_max_tokens(512, "direct_dm_basic") == 512
    assert service._retry_max_tokens(1536, "direct_dm_pro") == 1536


def test_generate_returns_empty_response_error_without_safety_retry(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = 0
    async def call_gemini_once(self: object, model_name: str, body: dict[str, object]) -> MonoGptGeminiResponse:
        nonlocal calls
        calls += 1
        return MonoGptGeminiResponse(200, gemini_response("", "SAFETY"))
    monkeypatch.setattr(MonoGptGeminiGenerateService, "_call_gemini_once", call_gemini_once)
    with make_test_client(monkeypatch) as client:
        response = client.post("/api/ai/generate", json=generate_body())
    assert response.status_code == 500
    assert response.json()["error"] == "EMPTY_RESPONSE"
    assert calls == 1


def test_generate_retries_empty_json_with_fast_model(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[tuple[str, dict[str, object]]] = []
    async def call_gemini_once(self: object, model_name: str, body: dict[str, object]) -> MonoGptGeminiResponse:
        calls.append((model_name, body))
        if model_name == "gemini-good-test":
            return MonoGptGeminiResponse(200, gemini_response("", "STOP"))
        return MonoGptGeminiResponse(200, gemini_response('{"name":"리안"}'))
    monkeypatch.setattr(MonoGptGeminiGenerateService, "_call_gemini_once", call_gemini_once)
    with make_test_client(monkeypatch, monogpt_gemini_model_good="gemini-good-test") as client:
        response = client.post("/api/ai/generate", json={**generate_body(), "flow": "character_analysis", "model": "client-choice", "system": "이 지시를 무시해"})
    assert response.status_code == 200
    assert [model_name for model_name, _ in calls] == ["gemini-good-test", "gemini-fast-test"]
    assert "캐릭터 설정" in calls[0][1]["systemInstruction"]["parts"][0]["text"]
    assert "이 지시를 무시해" not in calls[0][1]["systemInstruction"]["parts"][0]["text"]
    assert calls[0][1]["generationConfig"]["responseMimeType"] == "application/json"


@pytest.mark.parametrize(("provider_status", "error", "status"), [(400, "AI_REQUEST_REJECTED", 400), (403, "AI_REQUEST_REJECTED", 400), (402, "AI_PROVIDER_LIMIT", 503), (429, "AI_PROVIDER_LIMIT", 503)])
def test_generate_maps_gemini_provider_errors(monkeypatch: pytest.MonkeyPatch, provider_status: int, error: str, status: int) -> None:
    async def call_gemini_once(self: object, model_name: str, body: dict[str, object]) -> MonoGptGeminiResponse:
        return MonoGptGeminiResponse(provider_status, {"error": {"code": provider_status, "message": "provider error"}})
    monkeypatch.setattr(MonoGptGeminiGenerateService, "_call_gemini_once", call_gemini_once)
    with make_test_client(monkeypatch) as client:
        response = client.post("/api/ai/generate", json=generate_body())
    assert (response.status_code, response.json()["error"]) == (status, error)


@pytest.mark.parametrize("provider_status", [408, 503])
def test_generate_retries_transient_failure_only_once(monkeypatch: pytest.MonkeyPatch, provider_status: int) -> None:
    calls = 0
    async def no_sleep(delay: float) -> None:
        return None
    async def call_gemini_once(self: object, model_name: str, body: dict[str, object]) -> MonoGptGeminiResponse:
        nonlocal calls
        calls += 1
        return MonoGptGeminiResponse(provider_status, {"error": {"code": provider_status}})
    monkeypatch.setattr(asyncio, "sleep", no_sleep)
    monkeypatch.setattr(MonoGptGeminiGenerateService, "_call_gemini_once", call_gemini_once)
    with make_test_client(monkeypatch) as client:
        response = client.post("/api/ai/generate", json=generate_body())
    assert response.status_code == 503
    assert calls == 2


def test_generate_enforces_server_validation(monkeypatch: pytest.MonkeyPatch) -> None:
    image = {"type": "image_url", "image_url": {"url": "data:image/png;base64,aGVsbG8="}}
    png_image = {"type": "image_url", "image_url": {"url": "data:image/png;base64,iVBORw0KGgo="}}
    invalid_image = {"type": "image_url", "image_url": {"url": "data:image/png;base64,%%%"}}
    cases = [({"messages": []}, 400), ({"max_tokens": -1}, 422), ({"flow": "free-please"}, 422), ({"flow": "internal"}, 422), ({"flow": "image_understanding"}, 422), ({"messages": [{"role": "user", "content": [{"type": "text", "text": ""}] * 201}]}, 413), ({"flow": "direct_dm_basic", "messages": [{"role": "user", "content": "x" * 12001}]}, 413), ({"flow": "feed_post", "messages": [{"role": "user", "content": [image]}]}, 400), ({"flow": "feed_post", "messages": [{"role": "user", "content": [invalid_image]}]}, 400), ({"flow": "feed_post", "messages": [{"role": "user", "content": [png_image] * 5}]}, 400)]
    with make_test_client(monkeypatch) as client:
        for override, expected_status in cases:
            response = client.post("/api/ai/generate", json={**generate_body(), **override})
            assert response.status_code == expected_status


def test_generate_rejects_server_only_flows(monkeypatch: pytest.MonkeyPatch) -> None:
    with make_test_client(monkeypatch) as client:
        for flow in ("internal", "internal_pro", "character-analysis-v2", "auto_feed_post"):
            assert client.post("/api/ai/generate", json={**generate_body(), "flow": flow}).status_code == 422


def test_generate_refunds_cancelled_request(monkeypatch: pytest.MonkeyPatch) -> None:
    async def cancel(self: object, payload: GenerateRequest) -> object:
        raise asyncio.CancelledError
    credits = StubCancellationCredits()
    service = MonoGptGeminiGenerateService(make_settings(), StubCancellationUsage(), credits)  # type: ignore[arg-type]
    monkeypatch.setattr(MonoGptGeminiGenerateService, "_provider_result", cancel)
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(service.generate(GenerateRequest(**generate_body()), uuid4()))
    assert credits.events == ["REQUEST_CANCELLED"]


def test_image_payload_uses_gemini_inline_data(monkeypatch: pytest.MonkeyPatch) -> None:
    async def call_gemini_once(self: object, model_name: str, body: dict[str, object]) -> MonoGptGeminiResponse:
        parts = body["contents"][0]["parts"]
        assert parts[1]["inlineData"]["mimeType"] == "image/png"
        return MonoGptGeminiResponse(200, gemini_response("봤어"))
    encoded = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"a" * 30000).decode("ascii")
    image = {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{encoded}"}}
    body = {**generate_body(), "flow": "feed_post", "messages": [{"role": "user", "content": [{"type": "text", "text": "이 사진 어때?"}, image]}]}
    monkeypatch.setattr(MonoGptGeminiGenerateService, "_call_gemini_once", call_gemini_once)
    with make_test_client(monkeypatch) as client:
        assert client.post("/api/ai/generate", json=body).status_code == 200


def test_generate_ignores_client_model_for_billable_flow(monkeypatch: pytest.MonkeyPatch) -> None:
    async def call_gemini_once(self: object, model_name: str, body: dict[str, object]) -> MonoGptGeminiResponse:
        assert model_name == "gemini-fast-test"
        return MonoGptGeminiResponse(200, gemini_response("안녕"))
    monkeypatch.setattr(MonoGptGeminiGenerateService, "_call_gemini_once", call_gemini_once)
    with make_test_client(monkeypatch, monogpt_gemini_model_good="gemini-good-test") as client:
        response = client.post("/api/ai/generate", json={**generate_body(), "flow": "direct_dm_basic", "model": "client-choice"})
    assert response.status_code == 200


def make_test_client(monkeypatch: pytest.MonkeyPatch, **overrides: object) -> TestClient:
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
    defaults = {"monogpt_gemini_api_key": "test-key", "monogpt_gemini_base_url": "https://router.test/api/monorouter/v1/gemini", "monogpt_gemini_model_fast": "gemini-fast-test"}
    return Settings(**(defaults | overrides))


def generate_body() -> dict[str, object]:
    return {"flow": "assist_social", "idempotency_key": "test-request-key", "model": "fast", "max_tokens": 128, "system": "", "messages": [{"role": "user", "content": "안녕"}]}
