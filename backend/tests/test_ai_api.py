from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings
from app.main import app
from app.services.ai import GeminiGenerateService, GeminiResponse


def test_generate_returns_text_content(monkeypatch) -> None:
    async def call_gemini_once(self: object, model_name: str, body: dict[str, object]) -> GeminiResponse:
        assert model_name == "gemini-fast-test"
        assert body["generationConfig"] == {"maxOutputTokens": 128, "temperature": 0.9}
        return GeminiResponse(200, {"candidates": [{"content": {"parts": [{"text": "안녕"}]}}]})

    monkeypatch.setattr(GeminiGenerateService, "_call_gemini_once", call_gemini_once)
    with make_test_client() as client:
        response = client.post("/api/ai/generate", json=generate_body())
    assert response.status_code == 200
    assert response.json() == {"content": [{"type": "text", "text": "안녕"}]}


def test_generate_returns_empty_response_error(monkeypatch) -> None:
    async def call_gemini_once(self: object, model_name: str, body: dict[str, object]) -> GeminiResponse:
        return GeminiResponse(200, {"candidates": [{"finishReason": "SAFETY", "content": {"parts": []}}]})

    monkeypatch.setattr(GeminiGenerateService, "_call_gemini_once", call_gemini_once)
    with make_test_client() as client:
        response = client.post("/api/ai/generate", json=generate_body())
    assert response.status_code == 500
    assert response.json()["error"] == "EMPTY_RESPONSE"
    assert response.json()["finishReason"] == "SAFETY"


def test_generate_returns_provider_error(monkeypatch) -> None:
    async def call_gemini_once(self: object, model_name: str, body: dict[str, object]) -> GeminiResponse:
        return GeminiResponse(400, {"error": {"message": "bad request"}})

    monkeypatch.setattr(GeminiGenerateService, "_call_gemini_once", call_gemini_once)
    with make_test_client() as client:
        response = client.post("/api/ai/generate", json=generate_body())
    assert response.status_code == 500
    assert response.json()["error"] == "API_ERROR"
    assert response.json()["status"] == 400


def test_generate_enforces_daily_limit() -> None:
    with make_test_client(api_daily_limit=0) as client:
        response = client.post("/api/ai/generate", json=generate_body())
    assert response.status_code == 429
    assert response.json()["error"] == "DAILY_LIMIT_EXCEEDED"


def test_generate_requires_messages() -> None:
    with make_test_client() as client:
        response = client.post("/api/ai/generate", json={**generate_body(), "messages": []})
    assert response.status_code == 400
    assert response.json()["error"] == "BAD_REQUEST"


def make_test_client(**overrides: object) -> TestClient:
    settings = make_settings(**overrides)

    def stub_settings() -> Settings:
        return settings

    app.dependency_overrides[get_settings] = stub_settings
    return TestClient(app)


def make_settings(**overrides: object) -> Settings:
    return Settings(gemini_api_key="test-key", gemini_model_fast="gemini-fast-test", **overrides)


def generate_body() -> dict[str, object]:
    return {"model": "fast", "max_tokens": 128, "system": "", "messages": [{"role": "user", "content": "안녕"}]}
