from __future__ import annotations

from uuid import UUID

from app.core.ai_assist_policy import AssistKind, assist_policy, assist_system, valid_assist_output
from app.schemas.ai import AssistGenerateRequest, GenerateRequest
from app.services.ai import GenerateApiResult, MonoGptGeminiGenerateService


LEGACY_ASSIST_KINDS: dict[str, AssistKind] = {
    "feed-comment": "social_comment",
    "follower-post": "social_post",
    "relationship-proposal": "relationship_proposal",
    "relationship-judge": "relationship_judge",
    "session-affinity": "session_affinity",
    "session-summary": "session_summary",
}


class AssistGenerateService:
    def __init__(self, ai: MonoGptGeminiGenerateService) -> None:
        self.ai = ai

    async def generate(self, payload: AssistGenerateRequest, request: GenerateRequest, owner_id: UUID) -> GenerateApiResult:
        result = await self.ai.generate(request, owner_id, finalize_credit=False)
        if result.status_code != 200 or result.replayed:
            return result
        text = self._text(result)
        if not valid_assist_output(payload.kind, text):
            await self.ai.refund_result(result, owner_id, "INVALID_ASSIST_OUTPUT")
            return GenerateApiResult(500, {"error": "INVALID_ASSIST_OUTPUT", "message": "보조 기능 결과 형식이 올바르지 않아 사용량을 환급했습니다."})
        await self.ai.commit_result(result, owner_id)
        return result

    def _text(self, result: GenerateApiResult) -> str:
        content = result.body.get("content")
        if not isinstance(content, list) or not content or not isinstance(content[0], dict):
            return ""
        return str(content[0].get("text") or "")


def assist_request(payload: AssistGenerateRequest) -> GenerateRequest:
    policy = assist_policy(payload.kind)
    return GenerateRequest(flow=policy.flow, idempotency_key=payload.idempotency_key, max_tokens=policy.max_tokens, system=assist_system(payload.kind, payload.context), messages=payload.messages)


def legacy_assist_payload(payload: GenerateRequest) -> AssistGenerateRequest | None:
    kind = LEGACY_ASSIST_KINDS.get(payload.idempotency_key.split(":", 1)[0])
    if not kind or len(payload.messages) != 1 or assist_policy(kind).flow != payload.flow:
        return None
    context = payload.system.strip() or "추가 기능 맥락 없음"
    return AssistGenerateRequest(kind=kind, idempotency_key=payload.idempotency_key, context=context, messages=payload.messages)
