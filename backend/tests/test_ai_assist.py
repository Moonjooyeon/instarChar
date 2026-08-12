import asyncio
from uuid import UUID, uuid4

from app.schemas.ai import AssistGenerateRequest, GenerateRequest
from app.services.ai import GenerateApiResult
from app.services.ai_assist import AssistGenerateService, assist_request, legacy_assist_payload


class StubAi:
    def __init__(self, text: str) -> None:
        self.text = text
        self.events: list[str] = []

    async def generate(self, request: object, owner_id: UUID, finalize_credit: bool = True) -> GenerateApiResult:
        assert finalize_credit is False
        return GenerateApiResult(200, {"content": [{"type": "text", "text": self.text}]}, uuid4())

    async def refund_result(self, result: GenerateApiResult, owner_id: UUID, status: str) -> None:
        self.events.append(status)

    async def commit_result(self, result: GenerateApiResult, owner_id: UUID, body: dict[str, object] | None = None) -> None:
        self.events.append("committed")


def test_assist_request_uses_server_owned_flow_and_limits() -> None:
    payload = assist_payload("relationship_judge")
    request = assist_request(payload)
    assert (request.flow, request.max_tokens) == ("assist_relationship", 8)
    assert request.system.endswith("ACCEPT 또는 REJECT 중 하나만 출력한다.")


def test_legacy_assist_is_accepted_only_for_known_scope_and_single_message() -> None:
    request = GenerateRequest(flow="assist_social", idempotency_key="feed-comment:test-key", model="legacy-choice", max_tokens=4096, system="character context", messages=[{"role": "user", "content": "댓글"}])
    adapted = legacy_assist_payload(request)
    assert adapted is not None
    assert (adapted.kind, assist_request(adapted).max_tokens) == ("social_comment", 120)
    assert legacy_assist_payload(request.model_copy(update={"idempotency_key": "unknown:test-key"})) is None


def test_assist_service_commits_only_valid_output() -> None:
    ai = StubAi("ACCEPT")
    payload = assist_payload("relationship_judge")
    result = asyncio.run(AssistGenerateService(ai).generate(payload, assist_request(payload), uuid4()))  # type: ignore[arg-type]
    assert result.status_code == 200
    assert ai.events == ["committed"]


def test_assist_service_refunds_invalid_output() -> None:
    ai = StubAi("ACCEPT because this is better")
    payload = assist_payload("relationship_judge")
    result = asyncio.run(AssistGenerateService(ai).generate(payload, assist_request(payload), uuid4()))  # type: ignore[arg-type]
    assert (result.status_code, result.body["error"]) == (500, "INVALID_ASSIST_OUTPUT")
    assert ai.events == ["INVALID_ASSIST_OUTPUT"]


def assist_payload(kind: str) -> AssistGenerateRequest:
    return AssistGenerateRequest(kind=kind, idempotency_key="assist:test-key", context="character context", messages=[{"role": "user", "content": "판정:"}])  # type: ignore[arg-type]
