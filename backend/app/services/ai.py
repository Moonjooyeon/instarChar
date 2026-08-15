from __future__ import annotations

import asyncio
import json
import random
import re
from dataclasses import dataclass, field
from decimal import Decimal
from uuid import UUID

import httpx

from app.core.ai_cost import ProviderUsage, gemini_usage
from app.core.ai_prompt_policy import compose_system_instruction, valid_character_analysis
from app.core.config import Settings
from app.core.credit_policy import FlowPolicy, maximum_provider_cost_usd, resolve_flow
from app.repositories.ai_usage import AiUsageRepository, UsageReservation
from app.repositories.credits import CreditRepository, CreditReservation
from app.schemas.ai import GenerateMessage, GenerateRequest
from app.services.content_safety import is_safe_ai_content


RETRYABLE_STATUS_CODES = {408, 500, 502, 503, 504, 599}
NON_RETRYABLE_EMPTY_REASONS = {"CONTENT_FILTER", "ERROR", "SAFETY"}
UNSAFE_EMPTY_REASONS = {"CONTENT_FILTER", "SAFETY"}
JSON_SYSTEM_PATTERN = re.compile(r"JSON|json|json 객체|json으로|반드시 JSON")
DATA_URL_PATTERN = re.compile(r"^data:([^;,]+);base64,(.+)$")
GEMINI_SAFETY_SETTINGS = (
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
)
@dataclass(frozen=True)
class GenerateApiResult:
    status_code: int
    body: dict[str, object]
    credit_usage_id: UUID | None = None
    provider_usage: ProviderUsage = field(default_factory=ProviderUsage)
    replayed: bool = False


@dataclass(frozen=True)
class MonoGptGeminiResponse:
    status_code: int
    body: dict[str, object]
    retry_after: float = 0
    usage: ProviderUsage = field(default_factory=ProviderUsage)


class MonoGptGeminiGenerateService:
    def __init__(self, settings: Settings, usage_repository: AiUsageRepository, credit_repository: CreditRepository | None = None) -> None:
        self.settings = settings
        self.usage_repository = usage_repository
        self.credit_repository = credit_repository

    async def generate(self, payload: GenerateRequest, owner_id: UUID, finalize_credit: bool = True) -> GenerateApiResult:
        error = self._request_error(payload)
        if error:
            return error
        credit = await self._reserve_credit(payload, owner_id)
        if credit.replay_body is not None:
            return GenerateApiResult(200, credit.replay_body, credit.usage_id, replayed=True)
        if not credit.allowed:
            return GenerateApiResult(self._credit_error_status(credit.error_code), {"error": credit.error_code, "message": credit.message})
        policy = credit.policy or resolve_flow(payload.flow)
        usage = await self.usage_repository.reserve(owner_id, self.settings, self._maximum_provider_cost(policy), credit_usage_id=credit.usage_id)
        if not usage.allowed:
            await self._refund_credit(credit, owner_id, usage.error_code)
            return GenerateApiResult(429, {"error": usage.error_code, "message": usage.message})
        return await self._generate_reserved(payload, credit, usage, owner_id, finalize_credit)

    async def _generate_reserved(self, payload: GenerateRequest, credit: CreditReservation, usage: UsageReservation, owner_id: UUID, finalize_credit: bool) -> GenerateApiResult:
        await self._mark_provider_started(credit, owner_id)
        try:
            result = await self._provider_result(payload)
        except asyncio.CancelledError:
            await self.usage_repository.settle(owner_id, usage, ProviderUsage().cost_usd, measured=False)
            await self._refund_credit(credit, owner_id, "REQUEST_CANCELLED")
            raise
        await self.usage_repository.settle(owner_id, usage, result.provider_usage.cost_usd, result.provider_usage.measured)
        return await self._finalize_result(result, credit, owner_id, finalize_credit)

    def _request_error(self, payload: GenerateRequest) -> GenerateApiResult | None:
        if not self.settings.monogpt_gemini_api_key:
            return GenerateApiResult(500, {"error": "API_KEY_MISSING", "message": "서버에 MonoGPT Gemini API 키가 설정되지 않았습니다."})
        if not payload.messages:
            return GenerateApiResult(400, {"error": "BAD_REQUEST", "message": "messages 배열이 필요합니다."})
        if not is_safe_ai_content([message.content for message in payload.messages]):
            return GenerateApiResult(400, {"error": "CONTENT_POLICY_VIOLATION", "message": "안전 정책상 처리할 수 없는 내용이 포함되어 있어."})
        if self._payload_parts(payload) > 200:
            return GenerateApiResult(413, {"error": "PAYLOAD_TOO_LARGE", "message": "한 번에 보낼 수 있는 메시지 조각이 너무 많아."})
        if self._payload_chars(payload) > resolve_flow(payload.flow).max_input_chars:
            return GenerateApiResult(413, {"error": "CONTEXT_TOO_LONG", "message": "대화 맥락이 너무 길어. 새 대화에서 이어가줘."})
        return None

    async def _provider_result(self, payload: GenerateRequest) -> GenerateApiResult:
        try:
            return await self._generate_with_provider(payload)
        except Exception:
            return GenerateApiResult(500, {"error": "GENERATION_FAILED", "message": "AI 생성 처리에 실패했습니다."})

    async def _finalize_result(self, result: GenerateApiResult, credit: CreditReservation, owner_id: UUID, finalize_credit: bool) -> GenerateApiResult:
        if result.status_code != 200:
            await self._refund_credit(credit, owner_id, str(result.body.get("error") or "GENERATION_FAILED"), result.provider_usage)
        elif finalize_credit:
            await self._commit_credit(credit, owner_id, result.provider_usage, result.body)
        return GenerateApiResult(result.status_code, result.body, credit.usage_id, result.provider_usage)

    async def commit_result(self, result: GenerateApiResult, owner_id: UUID, body: dict[str, object] | None = None) -> None:
        if self.credit_repository and result.credit_usage_id:
            await self.credit_repository.commit_usage(result.credit_usage_id, owner_id, result.provider_usage, body or result.body)

    async def refund_result(self, result: GenerateApiResult, owner_id: UUID, status: str) -> None:
        if self.credit_repository and result.credit_usage_id:
            await self.credit_repository.refund_usage(result.credit_usage_id, owner_id, status, result.provider_usage)

    async def _reserve_credit(self, payload: GenerateRequest, owner_id: UUID) -> CreditReservation:
        if not self.credit_repository:
            return CreditReservation(True)
        return await self.credit_repository.reserve(owner_id, payload.flow, payload.idempotency_key)

    async def _commit_credit(self, credit: CreditReservation, owner_id: UUID, provider: ProviderUsage, body: dict[str, object]) -> None:
        if self.credit_repository and credit.usage_id:
            await self.credit_repository.commit_usage(credit.usage_id, owner_id, provider, body)

    async def _refund_credit(self, credit: CreditReservation, owner_id: UUID, status: str, provider: ProviderUsage | None = None) -> None:
        if self.credit_repository and credit.usage_id:
            await self.credit_repository.refund_usage(credit.usage_id, owner_id, status, provider)

    async def _mark_provider_started(self, credit: CreditReservation, owner_id: UUID) -> None:
        if self.credit_repository and credit.usage_id:
            await self.credit_repository.mark_provider_started(credit.usage_id, owner_id)

    def _credit_error_status(self, error_code: str) -> int:
        if error_code in {"FLOW_DAILY_LIMIT_EXCEEDED", "FREE_FLOW_DAILY_LIMIT_EXCEEDED"}:
            return 429
        if error_code in {"REQUEST_ALREADY_PROCESSED", "REQUEST_IN_PROGRESS"}:
            return 409
        return 402

    async def _generate_with_provider(self, payload: GenerateRequest) -> GenerateApiResult:
        request_body = self._gemini_body(payload)
        model_name = self._model_name(payload.flow)
        response = await self._call_gemini_safe(model_name, request_body)
        usage = response.usage
        text_result = self._text_result(response.body)
        if self._should_retry_response(payload, response, request_body, text_result):
            await asyncio.sleep(self._retry_delay(0, response))
            response = await self._call_gemini_safe(self._retry_model(payload, model_name, response), self._retry_body(payload, request_body))
            usage = usage.merged(response.usage)
            text_result = self._text_result(response.body)
        if response.status_code >= 400:
            return self._provider_error(response, usage)
        return self._final_result(payload, text_result, usage)

    async def _call_gemini_safe(self, model_name: str, body: dict[str, object]) -> MonoGptGeminiResponse:
        try:
            return await self._call_gemini_once(model_name, body)
        except httpx.HTTPError:
            return MonoGptGeminiResponse(599, {"error": {"code": 599, "status": "NETWORK_ERROR"}}, usage=ProviderUsage(model=model_name, attempts=1))

    async def _call_gemini_once(self, model_name: str, body: dict[str, object]) -> MonoGptGeminiResponse:
        async with httpx.AsyncClient(timeout=self.settings.monogpt_gemini_timeout_ms / 1000) as client:
            response = await client.post(self._gemini_url(model_name), headers=self._gemini_headers(), json=body)
        data = self._json_response(response)
        usage = gemini_usage(data, model_name, *self._model_rates(model_name))
        return MonoGptGeminiResponse(self._response_status(response.status_code, data), data, self._retry_after(response), usage)

    def _model_rates(self, model_name: str) -> tuple[Decimal, Decimal]:
        if model_name == self.settings.monogpt_gemini_model_good:
            return Decimal(str(self.settings.monogpt_gemini_good_input_rate_usd)), Decimal(str(self.settings.monogpt_gemini_good_output_rate_usd))
        return Decimal(str(self.settings.monogpt_gemini_fast_input_rate_usd)), Decimal(str(self.settings.monogpt_gemini_fast_output_rate_usd))

    def _maximum_provider_cost(self, policy: FlowPolicy) -> Decimal:
        rates = self._model_rates(self._model_name(policy.code))
        attempts = 2 if policy.model != "pro" or policy.code == "character_analysis" else 1
        return maximum_provider_cost_usd(policy, attempts, *rates)

    def _gemini_body(self, payload: GenerateRequest) -> dict[str, object]:
        system = self._system_instruction(payload)
        wants_json = self._wants_json(system)
        body: dict[str, object] = {"contents": self._contents(payload.messages), "generationConfig": self._generation_config(payload, wants_json), "safetySettings": [dict(item) for item in GEMINI_SAFETY_SETTINGS]}
        if system:
            body["systemInstruction"] = {"parts": [{"text": system}]}
        return body

    def _generation_config(self, payload: GenerateRequest, wants_json: bool) -> dict[str, object]:
        config: dict[str, object] = {"maxOutputTokens": self._max_tokens(payload.max_tokens, wants_json, payload.flow), "temperature": self._temperature(payload, wants_json), "thinkingConfig": {"thinkingBudget": resolve_flow(payload.flow).thinking_budget}}
        if wants_json:
            config["responseMimeType"] = "application/json"
        return config

    def _temperature(self, payload: GenerateRequest, wants_json: bool) -> float:
        if resolve_flow(payload.flow).code in {"feed_post", "auto_feed_post"}:
            return 0.75
        return 0.3 if wants_json else 0.9

    def _system_instruction(self, payload: GenerateRequest) -> str:
        if payload.flow.startswith("assist_") and payload.system.startswith("ALIVE_SERVER_POLICY:"):
            return payload.system
        return compose_system_instruction(payload.flow, payload.system)

    def _contents(self, messages: list[GenerateMessage]) -> list[dict[str, object]]:
        return [self._content(message) for message in messages]

    def _content(self, message: GenerateMessage) -> dict[str, object]:
        role = "model" if message.role == "assistant" else "user"
        return {"role": role, "parts": self._parts(message.content)}

    def _parts(self, content: object) -> list[dict[str, object]]:
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
            return self._image_part(self._image_url(record.get("image_url")))
        if part_type in {"image", "input_image"}:
            return self._image_part(record.get("dataUrl") or record.get("url") or record.get("image") or record.get("image_url"))
        return {"text": self._jsonish_text(part)}

    def _image_part(self, value: object) -> dict[str, object] | None:
        match = DATA_URL_PATTERN.match(str(value or ""))
        if not match:
            return None
        return {"inlineData": {"mimeType": match.group(1), "data": match.group(2)}}

    def _retry_body(self, payload: GenerateRequest, body: dict[str, object]) -> dict[str, object]:
        retry = dict(body)
        retry["contents"] = self._retry_contents(body.get("contents"))
        retry["generationConfig"] = self._retry_generation_config(payload, body.get("generationConfig"))
        return retry

    def _retry_contents(self, contents: object) -> list[object]:
        prompt = {"role": "user", "parts": [{"text": "직전 응답이 비어 있었다. 위 지시를 그대로 따르되, 반드시 빈 문자열이 아닌 최종 답변 본문만 출력하라."}]}
        return self._list_value(contents) + [prompt]

    def _retry_generation_config(self, payload: GenerateRequest, config: object) -> dict[str, object]:
        retry = dict(self._record(config))
        retry["maxOutputTokens"] = self._retry_max_tokens(retry.get("maxOutputTokens"), payload.flow)
        retry["temperature"] = 0.2 if self._wants_json(self._system_instruction(payload)) else 0.75
        return retry

    def _retry_max_tokens(self, value: object, flow: str) -> int:
        limit = resolve_flow(flow).max_output_tokens
        return min(max(int(value or 1), 1), limit)

    def _final_result(self, payload: GenerateRequest, text_result: dict[str, object], usage: ProviderUsage) -> GenerateApiResult:
        text = str(text_result.get("text") or "")
        finish_reason = str(text_result.get("finishReason") or "unknown")
        if text and not is_safe_ai_content(text):
            return GenerateApiResult(400, {"error": "AI_UNSAFE_OUTPUT", "message": "안전 정책에 따라 AI 응답을 표시하지 않았고 사용량을 환급했어."}, provider_usage=usage)
        if text and resolve_flow(payload.flow).code == "character_analysis" and not valid_character_analysis(text):
            return GenerateApiResult(500, {"error": "INVALID_STRUCTURED_OUTPUT", "message": "캐릭터 분석 결과 형식이 올바르지 않아 사용량을 환급했습니다."}, provider_usage=usage)
        if text:
            return GenerateApiResult(200, {"content": [{"type": "text", "text": text}]}, provider_usage=usage)
        if finish_reason.upper() in UNSAFE_EMPTY_REASONS:
            return GenerateApiResult(400, {"error": "AI_UNSAFE_OUTPUT", "message": "안전 정책에 따라 AI 응답을 표시하지 않았고 사용량을 환급했어."}, provider_usage=usage)
        return GenerateApiResult(500, self._empty_response_body(finish_reason), provider_usage=usage)

    def _empty_response_body(self, finish_reason: str) -> dict[str, object]:
        return {"error": "EMPTY_RESPONSE", "message": "AI 응답이 비어 있어 사용량을 환급했습니다.", "finishReason": finish_reason}

    def _provider_error(self, response: MonoGptGeminiResponse, usage: ProviderUsage) -> GenerateApiResult:
        code, status = self._provider_error_code(response.status_code)
        return GenerateApiResult(status, {"error": code, "message": self._provider_error_message(code), "status": response.status_code}, provider_usage=usage)

    def _provider_error_code(self, status: int) -> tuple[str, int]:
        if status in {402, 429}:
            return "AI_PROVIDER_LIMIT", 503
        if status == 401:
            return "AI_PROVIDER_AUTH", 503
        if status in {400, 403, 413, 422}:
            return "AI_REQUEST_REJECTED", 400
        return "AI_PROVIDER_UNAVAILABLE", 503

    def _provider_error_message(self, code: str) -> str:
        if code == "AI_REQUEST_REJECTED":
            return "요청을 처리할 수 없습니다. 내용을 확인해 다시 시도해줘."
        return "AI 서비스에 잠시 연결할 수 없습니다."

    def _text_result(self, data: dict[str, object]) -> dict[str, object]:
        candidate = self._first_record(data.get("candidates"))
        content = self._record(candidate.get("content"))
        return {"finishReason": candidate.get("finishReason"), "text": self._response_text(content.get("parts"))}

    def _response_text(self, parts: object) -> str:
        return "".join(str(self._record(part).get("text") or "") for part in self._list_value(parts))

    def _should_retry_empty(self, body: dict[str, object], text_result: dict[str, object]) -> bool:
        reason = str(text_result.get("finishReason") or "").upper()
        if reason in NON_RETRYABLE_EMPTY_REASONS:
            return False
        config = self._record(body.get("generationConfig"))
        return reason in {"STOP", "MAX_TOKENS"} or "responseMimeType" in config

    def _should_retry_response(self, payload: GenerateRequest, response: MonoGptGeminiResponse, body: dict[str, object], text_result: dict[str, object]) -> bool:
        if resolve_flow(payload.flow).model == "pro":
            return payload.flow == "character_analysis" and response.status_code < 400 and self._should_retry_analysis(body, text_result)
        if response.status_code in RETRYABLE_STATUS_CODES:
            return True
        if response.status_code >= 400 or text_result.get("text"):
            return False
        return self._should_retry_empty(body, text_result)

    def _should_retry_analysis(self, body: dict[str, object], text_result: dict[str, object]) -> bool:
        text = str(text_result.get("text") or "")
        return not valid_character_analysis(text) or self._should_retry_empty(body, text_result)

    def _retry_model(self, payload: GenerateRequest, model_name: str, response: MonoGptGeminiResponse) -> str:
        if payload.flow == "character_analysis" and response.status_code < 400:
            return self.settings.monogpt_gemini_model_fast
        return model_name

    def _gemini_url(self, model_name: str) -> str:
        base = self.settings.monogpt_gemini_base_url.rstrip("/")
        return f"{base}/v1beta/models/{model_name}:generateContent"

    def _gemini_headers(self) -> dict[str, str]:
        return {"Content-Type": "application/json", "x-goog-api-key": self.settings.monogpt_gemini_api_key}

    def _model_name(self, flow: str) -> str:
        return self.settings.monogpt_gemini_model_good if resolve_flow(flow).model == "pro" else self.settings.monogpt_gemini_model_fast

    def _max_tokens(self, value: int, wants_json: bool, flow: str) -> int:
        policy = resolve_flow(flow)
        requested = max(value or 2048, 2048) if wants_json else value or 2048
        return min(max(requested, 1), policy.max_output_tokens)

    def _payload_chars(self, payload: GenerateRequest) -> int:
        return len(payload.system) + sum(self._content_chars(message.content) for message in payload.messages)

    def _payload_parts(self, payload: GenerateRequest) -> int:
        return sum(len(message.content) if isinstance(message.content, list) else 1 for message in payload.messages)

    def _content_chars(self, content: object) -> int:
        if isinstance(content, str):
            return len(content)
        if isinstance(content, list):
            return sum(self._part_chars(part) for part in content)
        return len(self._jsonish_text(content))

    def _part_chars(self, part: object) -> int:
        record = self._record(part)
        if str(record.get("type") or "") == "text":
            return len(str(record.get("text") or ""))
        if str(record.get("type") or "") in {"image", "image_url", "input_image"}:
            return 0
        return len(self._jsonish_text(part))

    def _wants_json(self, system: str) -> bool:
        return bool(JSON_SYSTEM_PATTERN.search(system or ""))

    def _json_response(self, response: httpx.Response) -> dict[str, object]:
        try:
            data = response.json()
        except ValueError:
            return {"error": {"code": 502, "message": f"MonoGPT Gemini가 JSON이 아닌 응답을 보냈습니다. HTTP {response.status_code}"}}
        if isinstance(data, dict):
            return data
        return {"error": {"code": 502, "message": "MonoGPT Gemini 응답 형식이 올바르지 않습니다."}}

    def _response_status(self, http_status: int, data: dict[str, object]) -> int:
        if http_status >= 400:
            return http_status
        return self._error_status(self._record(data.get("error")).get("code")) if data.get("error") else http_status

    def _error_status(self, value: object) -> int:
        try:
            status = int(value or 502)
        except (TypeError, ValueError):
            return 502
        return status if status >= 400 else 502

    def _retry_after(self, response: httpx.Response) -> float:
        try:
            return float(response.headers.get("retry-after") or 0)
        except ValueError:
            return 0

    def _retry_delay(self, attempt: int, response: MonoGptGeminiResponse | None) -> float:
        if response and response.retry_after > 0:
            return response.retry_after
        return (600 * (2 ** attempt) + random.randint(0, 249)) / 1000

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
