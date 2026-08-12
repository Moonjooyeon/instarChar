from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Literal

from app.core.ai_prompt_policy import SERVER_PREFIX


AssistKind = Literal["social_comment", "social_post", "relationship_proposal", "relationship_judge", "session_affinity", "session_summary"]


@dataclass(frozen=True)
class AssistPolicy:
    flow: str
    max_tokens: int
    contract: str


ASSIST_POLICIES: dict[AssistKind, AssistPolicy] = {
    "social_comment": AssistPolicy("assist_social", 120, "캐릭터 말투의 SNS 댓글 본문만 1~2문장으로 출력한다. 따옴표, 분석, 설명은 쓰지 않는다."),
    "social_post": AssistPolicy("assist_social", 160, "캐릭터의 1인칭 SNS 게시글 본문만 200자 이하로 출력한다. 자기소개, 분석, 설명은 쓰지 않는다."),
    "relationship_proposal": AssistPolicy("assist_relationship", 120, "상대에 대한 마음을 털어놓는 캐릭터 대사 한 줄만 출력한다. 따옴표와 설명은 쓰지 않는다."),
    "relationship_judge": AssistPolicy("assist_relationship", 8, "주어진 관계와 호감도만 보고 ACCEPT 또는 REJECT 중 하나만 출력한다."),
    "session_affinity": AssistPolicy("assist_session", 8, "주어진 대화에서 생긴 호감도 변화 정수 하나만 -30부터 8 사이로 출력한다."),
    "session_summary": AssistPolicy("assist_session", 1024, "설명 없이 JSON 객체 하나만 출력한다. 키는 aff_a_to_b, aff_b_to_a, mem_a, mem_b이며 기억 배열 항목은 content와 importance만 가진다."),
}


def assist_policy(kind: AssistKind) -> AssistPolicy:
    return ASSIST_POLICIES[kind]


def assist_system(kind: AssistKind, context: str) -> str:
    policy = assist_policy(kind)
    return f"{SERVER_PREFIX}\nASSIST_KIND: {kind}\n\n[기능 맥락 데이터]\n{context.strip()}\n\n[필수 출력 계약]\n{policy.contract}"


def valid_assist_output(kind: AssistKind, text: str) -> bool:
    value = text.strip()
    if kind == "social_comment":
        return bool(value) and len(value) <= 240
    if kind == "social_post":
        return bool(value) and len(value) <= 200
    if kind == "relationship_proposal":
        return bool(value) and len(value) <= 240
    if kind == "relationship_judge":
        return value in {"ACCEPT", "REJECT"}
    if kind == "session_affinity":
        return _valid_affinity(value)
    return _valid_summary(value)


def _valid_affinity(value: str) -> bool:
    if not re.fullmatch(r"-?\d+", value):
        return False
    return -30 <= int(value) <= 8


def _valid_summary(value: str) -> bool:
    try:
        record = json.loads(value)
    except json.JSONDecodeError:
        return False
    if not isinstance(record, dict):
        return False
    return _valid_delta(record.get("aff_a_to_b")) and _valid_delta(record.get("aff_b_to_a")) and _valid_memories(record.get("mem_a")) and _valid_memories(record.get("mem_b"))


def _valid_delta(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and -30 <= value <= 8


def _valid_memories(value: object) -> bool:
    if not isinstance(value, list) or len(value) > 1:
        return False
    return all(_valid_memory(item) for item in value)


def _valid_memory(value: object) -> bool:
    if not isinstance(value, dict):
        return False
    content = value.get("content")
    importance = value.get("importance")
    return isinstance(content, str) and 1 <= len(content.strip()) <= 300 and isinstance(importance, int) and not isinstance(importance, bool) and 3 <= importance <= 5
