from __future__ import annotations

import asyncio
import json
import random
import re
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx
from fastapi import Request

from app.core.config import Settings
from app.schemas.ai import GenerateMessage, GenerateRequest


API_LIMIT_MESSAGE = "오늘 설정된 API 사용량을 모두 사용했어. 다음에 다시 만나자."
RETRYABLE_STATUS_CODES = {429, 500, 503, 504}
JSON_SYSTEM_PATTERN = re.compile(r"JSON|json|json 객체|json으로|반드시 JSON")
DATA_URL_PATTERN = re.compile(r"^data:([^;,]+);base64,(.+)$")
_daily_usage: dict[str, int] = {}
_monthly_usage: dict[str, float] = {}


@dataclass(frozen=True)
class GenerateApiResult:
    status_code: int
    body: dict[str, object]


@dataclass(frozen=True)
class GeminiResponse:
    status_code: int
    body: dict[str, object]
    retry_after: float = 0


@dataclass(frozen=True)
class UsageCheck:
    blocked: bool
    daily_key: str = ""
    month: str = ""
    monthly_cost: float = 0
    status_code: int = 200
    body: dict[str, object] | None = None


class GeminiGenerateService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def generate(self, payload: GenerateRequest, request: Request) -> GenerateApiResult:
        if not self.settings.gemini_api_key:
            return GenerateApiResult(500, {"error": "API_KEY_MISSING", "message": "서버에 Gemini API 키가 설정되지 않았습니다."})
        usage = self._check_usage_limit(request)
        if usage.blocked:
            return GenerateApiResult(usage.status_code, usage.body or {})
        if not payload.messages:
            return GenerateApiResult(400, {"error": "BAD_REQUEST", "message": "messages 배열이 필요합니다."})
        return await self._generate_with_provider(payload, usage)

    async def _generate_with_provider(self, payload: GenerateRequest, usage: UsageCheck) -> GenerateApiResult:
        gemini_body = self._gemini_body(payload)
        model_name = self._model_name(payload.model)
        response = await self._call_with_retries(model_name, gemini_body)
        if response.status_code >= 400:
            return self._provider_error(response)
        text_result = self._text_result(response.body)
        if not text_result["text"] and self._should_retry_empty(payload, gemini_body, text_result):
            response = await self._retry_empty_response(payload, model_name, gemini_body)
            if response.status_code >= 400:
                return self._provider_error(response)
            text_result = self._text_result(response.body)
        return self._final_result(text_result, response.body, usage)

    async def _retry_empty_response(self, payload: GenerateRequest, model_name: str, body: dict[str, object]) -> GeminiResponse:
        retry_body = self._retry_body(payload, body)
        return await self._call_with_retries(model_name, retry_body)

    async def _call_with_retries(self, model_name: str, body: dict[str, object]) -> GeminiResponse:
        last_response: GeminiResponse | None = None
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                last_response = await self._call_gemini_once(model_name, body)
                if last_response.status_code not in RETRYABLE_STATUS_CODES:
                    return last_response
            except httpx.HTTPError as error:
                last_error = error
                if attempt >= 2:
                    raise RuntimeError(str(error)) from error
            if attempt < 2:
                await asyncio.sleep(self._retry_delay(attempt, last_response))
        if last_response:
            return last_response
        raise RuntimeError(str(last_error))

    async def _call_gemini_once(self, model_name: str, body: dict[str, object]) -> GeminiResponse:
        async with httpx.AsyncClient(timeout=self.settings.gemini_timeout_ms / 1000) as client:
            response = await client.post(self._gemini_url(model_name), headers=self._gemini_headers(), json=body)
        return GeminiResponse(response.status_code, self._json_response(response), self._retry_after(response))

    def _gemini_body(self, payload: GenerateRequest) -> dict[str, object]:
        wants_json = self._wants_json(payload.system)
        config: dict[str, object] = {"maxOutputTokens": self._max_tokens(payload.max_tokens, wants_json), "temperature": 0.3 if wants_json else 0.9}
        if wants_json:
            config["responseMimeType"] = "application/json"
        body: dict[str, object] = {"contents": [self._message_content(item) for item in payload.messages], "generationConfig": config}
        if payload.system:
            body["systemInstruction"] = {"parts": [{"text": payload.system}]}
        return body

    def _message_content(self, message: GenerateMessage) -> dict[str, object]:
        parts = self._message_parts(message.content)
        return {"role": "model" if message.role == "assistant" else "user", "parts": parts or [{"text": ""}]}

    def _message_parts(self, content: object) -> list[dict[str, object]]:
        if isinstance(content, str):
            return [{"text": content}]
        if isinstance(content, list):
            return [part for item in content if (part := self._content_part(item))]
        return [{"text": self._jsonish_text(content)}]

    def _content_part(self, part: object) -> dict[str, object] | None:
        record = self._record(part)
        part_type = str(record.get("type") or "")
        if part_type == "text":
            return {"text": str(record.get("text") or "")}
        if part_type == "image_url":
            return self._inline_data_part(self._image_url(record.get("image_url")))
        if part_type in {"image", "input_image"}:
            return self._inline_data_part(record.get("dataUrl") or record.get("url") or record.get("image") or record.get("image_url"))
        return {"text": self._jsonish_text(part)}

    def _inline_data_part(self, value: object) -> dict[str, object] | None:
        match = DATA_URL_PATTERN.match(str(value or ""))
        if not match:
            return None
        return {"inlineData": {"mimeType": match.group(1), "data": match.group(2)}}

    def _retry_body(self, payload: GenerateRequest, body: dict[str, object]) -> dict[str, object]:
        retry = dict(body)
        retry["generationConfig"] = self._retry_config(self._record(body.get("generationConfig")), self._wants_json(payload.system))
        retry["contents"] = self._retry_contents(body.get("contents"))
        return retry

    def _retry_config(self, config: dict[str, object], wants_json: bool) -> dict[str, object]:
        next_config = dict(config)
        next_config["maxOutputTokens"] = max(int(next_config.get("maxOutputTokens") or 2048), 4096)
        next_config["temperature"] = 0.2 if wants_json else 0.75
        next_config.pop("responseMimeType", None)
        return next_config

    def _retry_contents(self, contents: object) -> list[object]:
        retry_prompt = {"role": "user", "parts": [{"text": "직전 응답이 비어 있었다. 위 지시를 그대로 따르되, 반드시 빈 문자열이 아닌 최종 답변 본문만 출력하라."}]}
        return self._list_value(contents) + [retry_prompt]

    def _final_result(self, text_result: dict[str, object], data: dict[str, object], usage: UsageCheck) -> GenerateApiResult:
        text = str(text_result.get("text") or "")
        if text:
            self._record_usage(usage)
            return GenerateApiResult(200, {"content": [{"type": "text", "text": text}]})
        finish_reason = str(text_result.get("finishReason") or self._record(data.get("promptFeedback")).get("blockReason") or "unknown")
        return GenerateApiResult(500, self._empty_response_body(finish_reason, text_result, data))

    def _empty_response_body(self, finish_reason: str, text_result: dict[str, object], data: dict[str, object]) -> dict[str, object]:
        candidate = self._record(text_result.get("candidate"))
        detail = {"promptFeedback": data.get("promptFeedback"), "candidate": self._candidate_detail(candidate)}
        return {"error": "EMPTY_RESPONSE", "message": f"Gemini가 빈 응답을 반환했습니다. finishReason: {finish_reason}", "finishReason": finish_reason, "detail": detail}

    def _candidate_detail(self, candidate: dict[str, object]) -> dict[str, object] | None:
        if not candidate:
            return None
        return {"finishReason": candidate.get("finishReason"), "safetyRatings": candidate.get("safetyRatings")}

    def _provider_error(self, response: GeminiResponse) -> GenerateApiResult:
        return GenerateApiResult(500, {"error": "API_ERROR", "status": response.status_code, "detail": response.body})

    def _text_result(self, data: dict[str, object]) -> dict[str, object]:
        candidate = self._first_record(data.get("candidates"))
        content = self._record(candidate.get("content"))
        parts = [self._record(item) for item in self._list_value(content.get("parts"))]
        text = "".join(str(item.get("text") or "") for item in parts)
        return {"candidate": candidate, "finishReason": candidate.get("finishReason"), "text": text}

    def _should_retry_empty(self, payload: GenerateRequest, body: dict[str, object], text_result: dict[str, object]) -> bool:
        config = self._record(body.get("generationConfig"))
        reason = str(text_result.get("finishReason") or "")
        return reason in {"STOP", "MAX_TOKENS"} or (self._wants_json(payload.system) and "responseMimeType" in config)

    def _check_usage_limit(self, request: Request) -> UsageCheck:
        now = datetime.now(timezone.utc)
        daily_key = f"{self._period_key(now, 'day')}:{self._client_key(request)}"
        month = self._period_key(now, "month")
        daily_count = _daily_usage.get(daily_key, 0)
        monthly_cost = _monthly_usage.get(month, 0)
        if daily_count >= self.settings.api_daily_limit:
            return UsageCheck(True, status_code=429, body={"error": "DAILY_LIMIT_EXCEEDED", "message": API_LIMIT_MESSAGE})
        if monthly_cost + self.settings.api_estimated_call_cost_usd > self.settings.api_monthly_cost_limit_usd:
            return UsageCheck(True, status_code=429, body={"error": "MONTHLY_COST_LIMIT_EXCEEDED", "message": API_LIMIT_MESSAGE})
        return UsageCheck(False, daily_key=daily_key, month=month, monthly_cost=monthly_cost)

    def _record_usage(self, usage: UsageCheck) -> None:
        _daily_usage[usage.daily_key] = _daily_usage.get(usage.daily_key, 0) + 1
        _monthly_usage[usage.month] = usage.monthly_cost + self.settings.api_estimated_call_cost_usd

    def _client_key(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for", "")
        first_ip = forwarded.split(",")[0].strip()
        return first_ip or request.headers.get("x-real-ip") or (request.client.host if request.client else "local")

    def _gemini_url(self, model_name: str) -> str:
        return f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"

    def _gemini_headers(self) -> dict[str, str]:
        return {"Content-Type": "application/json", "x-goog-api-key": self.settings.gemini_api_key}

    def _model_name(self, requested_model: str) -> str:
        model = requested_model.lower()
        return self.settings.gemini_model_good if "sonnet" in model or "opus" in model else self.settings.gemini_model_fast

    def _max_tokens(self, value: int, wants_json: bool) -> int:
        return max(value or 2048, 2048) if wants_json else value or 2048

    def _wants_json(self, system: str) -> bool:
        return bool(JSON_SYSTEM_PATTERN.search(system or ""))

    def _json_response(self, response: httpx.Response) -> dict[str, object]:
        try:
            data = response.json()
        except ValueError:
            return {"error": "BAD_UPSTREAM_JSON", "message": f"Gemini가 JSON이 아닌 응답을 보냈습니다. HTTP {response.status_code}", "raw": response.text[:500]}
        return self._record(data)

    def _retry_after(self, response: httpx.Response) -> float:
        try:
            return float(response.headers.get("retry-after") or 0)
        except ValueError:
            return 0

    def _retry_delay(self, attempt: int, response: GeminiResponse | None) -> float:
        if response and response.retry_after > 0:
            return response.retry_after
        return (600 * (2 ** attempt) + random.randint(0, 249)) / 1000

    def _period_key(self, date: datetime, period_type: str) -> str:
        return date.strftime("%Y-%m") if period_type == "month" else date.strftime("%Y-%m-%d")

    def _image_url(self, value: object) -> object:
        return self._record(value).get("url") if isinstance(value, dict) else value

    def _record(self, value: object) -> dict[str, object]:
        return value if isinstance(value, dict) else {}

    def _first_record(self, value: object) -> dict[str, object]:
        items = self._list_value(value)
        return self._record(items[0]) if items else {}

    def _list_value(self, value: object) -> list[object]:
        return value if isinstance(value, list) else []

    def _jsonish_text(self, value: object) -> str:
        return json.dumps(value, ensure_ascii=False)
