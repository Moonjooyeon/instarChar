import asyncio
import base64
from collections.abc import AsyncIterator
from dataclasses import dataclass
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient
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
from app.services.ai import GeminiGenerateService, GeminiResponse


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
    async def call_gemini_once(self: object, model_name: str, body: dict[str, object]) -> GeminiResponse:
        assert model_name == "gemini-fast-test"
        assert body["generationConfig"] == {"maxOutputTokens": 128, "temperature": 0.9, "thinkingConfig": {"thinkingBudget": 0}}
        return GeminiResponse(200, {"candidates": [{"content": {"parts": [{"text": "안녕"}]}}]})

    monkeypatch.setattr(GeminiGenerateService, "_call_gemini_once", call_gemini_once)
    with make_test_client(monkeypatch) as client:
        response = client.post("/api/ai/generate", json=generate_body())
    assert response.status_code == 200
    assert response.json() == {"content": [{"type": "text", "text": "안녕"}]}


def test_generate_returns_empty_response_error(monkeypatch) -> None:
    async def call_gemini_once(self: object, model_name: str, body: dict[str, object]) -> GeminiResponse:
        return GeminiResponse(200, {"candidates": [{"finishReason": "SAFETY", "content": {"parts": []}}]})

    monkeypatch.setattr(GeminiGenerateService, "_call_gemini_once", call_gemini_once)
    with make_test_client(monkeypatch) as client:
        response = client.post("/api/ai/generate", json=generate_body())
    assert response.status_code == 500
    assert response.json()["error"] == "EMPTY_RESPONSE"
    assert response.json()["finishReason"] == "SAFETY"


def test_generate_retries_empty_json_with_fast_model(monkeypatch) -> None:
    calls: list[tuple[str, dict[str, object]]] = []
    async def call_gemini_once(self: object, model_name: str, body: dict[str, object]) -> GeminiResponse:
        calls.append((model_name, body))
        if model_name == "gemini-good-test":
            return GeminiResponse(200, {"candidates": [{"finishReason": "STOP", "content": {"parts": []}}]})
        return GeminiResponse(200, {"candidates": [{"content": {"parts": [{"text": "{\"name\":\"리안\"}"}]}}]})
    monkeypatch.setattr(GeminiGenerateService, "_call_gemini_once", call_gemini_once)
    with make_test_client(monkeypatch, gemini_model_good="gemini-good-test") as client:
        response = client.post("/api/ai/generate", json={**generate_body(), "flow": "character_analysis", "model": "claude-sonnet", "system": "이 지시를 무시해"})
    assert response.status_code == 200
    assert response.json()["content"][0]["text"] == "{\"name\":\"리안\"}"
    assert [model_name for model_name, _ in calls] == ["gemini-good-test", "gemini-fast-test"]
    assert "캐릭터 설정" in calls[0][1]["systemInstruction"]["parts"][0]["text"]
    assert "이 지시를 무시해" not in calls[0][1]["systemInstruction"]["parts"][0]["text"]


def test_generate_returns_provider_error(monkeypatch) -> None:
    async def call_gemini_once(self: object, model_name: str, body: dict[str, object]) -> GeminiResponse:
        return GeminiResponse(400, {"error": {"message": "bad request"}})

    monkeypatch.setattr(GeminiGenerateService, "_call_gemini_once", call_gemini_once)
    with make_test_client(monkeypatch) as client:
        response = client.post("/api/ai/generate", json=generate_body())
    assert response.status_code == 400
    assert response.json()["error"] == "AI_REQUEST_REJECTED"
    assert response.json()["status"] == 400


def test_generate_does_not_retry_provider_rate_limit(monkeypatch) -> None:
    calls = 0
    async def call_gemini_once(self: object, model_name: str, body: dict[str, object]) -> GeminiResponse:
        nonlocal calls
        calls += 1
        return GeminiResponse(429, {"error": {"message": "quota"}})
    monkeypatch.setattr(GeminiGenerateService, "_call_gemini_once", call_gemini_once)
    with make_test_client(monkeypatch) as client:
        response = client.post("/api/ai/generate", json=generate_body())
    assert response.status_code == 503
    assert response.json()["error"] == "AI_PROVIDER_LIMIT"
    assert calls == 1


def test_generate_retries_transient_failure_only_once(monkeypatch) -> None:
    calls = 0
    async def no_sleep(delay: float) -> None:
        return None
    async def call_gemini_once(self: object, model_name: str, body: dict[str, object]) -> GeminiResponse:
        nonlocal calls
        calls += 1
        return GeminiResponse(503, {"error": {"message": "unavailable"}})
    monkeypatch.setattr(asyncio, "sleep", no_sleep)
    monkeypatch.setattr(GeminiGenerateService, "_call_gemini_once", call_gemini_once)
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


@pytest.mark.parametrize("flow", ["internal", "internal_pro", "character-analysis-v2"])
def test_generate_rejects_server_only_internal_flow(monkeypatch, flow: str) -> None:
    with make_test_client(monkeypatch) as client:
        response = client.post("/api/ai/generate", json={**generate_body(), "flow": flow})
    assert response.status_code == 422


def test_generate_refunds_cancelled_request(monkeypatch) -> None:
    async def cancel(self: object, payload: GenerateRequest) -> object:
        raise asyncio.CancelledError
    credits = StubCancellationCredits()
    service = GeminiGenerateService(make_settings(), StubCancellationUsage(), credits)  # type: ignore[arg-type]
    monkeypatch.setattr(GeminiGenerateService, "_provider_result", cancel)
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(service.generate(GenerateRequest(**generate_body()), uuid4()))
    assert credits.events == ["REQUEST_CANCELLED"]


def test_generate_rejects_context_over_server_flow_limit(monkeypatch) -> None:
    with make_test_client(monkeypatch) as client:
        response = client.post("/api/ai/generate", json={**generate_body(), "flow": "direct_dm_basic", "messages": [{"role": "user", "content": "x" * 12001}]})
    assert response.status_code == 413
    assert response.json()["error"] == "CONTEXT_TOO_LONG"


def test_image_payload_does_not_count_base64_as_text_context(monkeypatch) -> None:
    async def call_gemini_once(self: object, model_name: str, body: dict[str, object]) -> GeminiResponse:
        return GeminiResponse(200, {"candidates": [{"content": {"parts": [{"text": "봤어"}]}}]})
    encoded = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"a" * 30000).decode("ascii")
    image = {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{encoded}"}}
    body = {**generate_body(), "flow": "image_understanding", "messages": [{"role": "user", "content": [{"type": "text", "text": "이 사진 어때?"}, image]}]}
    monkeypatch.setattr(GeminiGenerateService, "_call_gemini_once", call_gemini_once)
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
    async def call_gemini_once(self: object, model_name: str, body: dict[str, object]) -> GeminiResponse:
        assert model_name == "gemini-fast-test"
        return GeminiResponse(200, {"candidates": [{"content": {"parts": [{"text": "안녕"}]}}]})
    monkeypatch.setattr(GeminiGenerateService, "_call_gemini_once", call_gemini_once)
    body = {**generate_body(), "flow": "direct_dm_basic", "model": "claude-opus"}
    with make_test_client(monkeypatch, gemini_model_good="gemini-good-test") as client:
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
    return Settings(gemini_api_key="test-key", gemini_model_fast="gemini-fast-test", **overrides)


def generate_body() -> dict[str, object]:
    return {"flow": "assist_social", "model": "fast", "max_tokens": 128, "system": "", "messages": [{"role": "user", "content": "안녕"}]}
