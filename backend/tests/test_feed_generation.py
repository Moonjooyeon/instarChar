from __future__ import annotations

import asyncio
import json
from collections.abc import Coroutine
from dataclasses import dataclass
from uuid import uuid4

from pytest import MonkeyPatch

from app.core.config import Settings
from app.repositories.ai_usage import UsageReservation
from app.schemas.character_posts import CharacterPostsResponse, FeedPostGenerateRequest
from app.services.ai import GenerateApiResult, GeminiGenerateService
from app.services.feed_generation import FeedGenerationService


@dataclass
class StubCharacter:
    name: str = "세인"
    character: dict[str, object] = None
    posts: list[object] = None
    auto_post_failure_count: int = 0


class StubPosts:
    def __init__(self) -> None:
        self.saved: dict[str, object] | None = None
        self.error: str = ""

    async def owned_character(self, owner_id: object, source_account_id: str) -> StubCharacter:
        return StubCharacter(character={"persona": "차분함"}, posts=[])

    async def append_generated_post(self, owner_id: object, source_account_id: str, post: dict[str, object], is_auto: bool = False) -> CharacterPostsResponse:
        self.saved = post
        return CharacterPostsResponse(posts=[post], revision=1, auto_post_enabled=False, auto_post_interval_seconds=900)

    async def record_auto_failure(self, owner_id: object, source_account_id: str, error: str, retry_at: object) -> None:
        self.error = error


class StubUsage:
    async def reserve(self, owner_id: object, settings: Settings) -> UsageReservation:
        return UsageReservation(True)


class FailingPosts(StubPosts):
    async def append_generated_post(self, owner_id: object, source_account_id: str, post: dict[str, object], is_auto: bool = False) -> CharacterPostsResponse:
        raise RuntimeError("database unavailable")


def test_feed_generation_excludes_profile_images_from_prompt() -> None:
    service = FeedGenerationService(StubPosts(), StubUsage(), Settings(gemini_api_key="test"))
    character = {"persona": "차분함", "avatarImg": "data:image/png;base64,avatar", "headerImg": "data:image/png;base64,header"}
    request = service._request("세인", character, [], "일상")
    content = request.messages[0].content
    assert isinstance(content, str)
    prompt = json.loads(content)
    assert prompt["character"] == {"persona": "차분함"}


def test_feed_generation_parses_and_saves_provider_result(monkeypatch: MonkeyPatch) -> None:
    events: list[str] = []
    async def generate(self: object, payload: object, owner_id: object, finalize_credit: bool = True) -> GenerateApiResult:
        assert finalize_credit is False
        return GenerateApiResult(200, {"content": [{"type": "text", "text": '{"text":"바람이 좋다","moodDesc":"평온"}'}]}, uuid4())
    async def commit(self: object, result: GenerateApiResult, owner_id: object) -> None:
        events.append("committed")

    monkeypatch.setattr(GeminiGenerateService, "generate", generate)
    monkeypatch.setattr(GeminiGenerateService, "commit_result", commit)
    posts = StubPosts()
    service = FeedGenerationService(posts, StubUsage(), Settings(gemini_api_key="test"))
    result = run(service.generate(uuid4(), "char-1", FeedPostGenerateRequest(mood="일상")))
    assert result.status_code == 200
    assert posts.saved is not None
    assert posts.saved["text"] == "바람이 좋다"
    assert posts.saved["moodDesc"] == "평온"
    assert events == ["committed"]


def test_feed_generation_does_not_save_failure_placeholder(monkeypatch: MonkeyPatch) -> None:
    events: list[str] = []
    async def generate(self: object, payload: object, owner_id: object, finalize_credit: bool = True) -> GenerateApiResult:
        return GenerateApiResult(200, {"content": [{"type": "text", "text": "게시글 생성 실패"}]}, uuid4())
    async def refund(self: object, result: GenerateApiResult, owner_id: object, status: str) -> None:
        events.append(status)

    monkeypatch.setattr(GeminiGenerateService, "generate", generate)
    monkeypatch.setattr(GeminiGenerateService, "refund_result", refund)
    posts = StubPosts()
    service = FeedGenerationService(posts, StubUsage(), Settings(gemini_api_key="test"))
    result = run(service.generate(uuid4(), "char-1", FeedPostGenerateRequest()))
    assert result.status_code == 500
    assert posts.saved is None
    assert events == ["INVALID_POST"]


def test_feed_generation_does_not_save_when_usage_is_blocked(monkeypatch: MonkeyPatch) -> None:
    async def generate(self: object, payload: object, owner_id: object, finalize_credit: bool = True) -> GenerateApiResult:
        return GenerateApiResult(429, {"error": "DAILY_LIMIT_EXCEEDED"})

    monkeypatch.setattr(GeminiGenerateService, "generate", generate)
    posts = StubPosts()
    service = FeedGenerationService(posts, StubUsage(), Settings(gemini_api_key="test"))
    result = run(service.generate(uuid4(), "char-1", FeedPostGenerateRequest(), is_auto=True))
    assert result.status_code == 429
    assert posts.saved is None
    assert posts.error.startswith("DAILY_LIMIT_EXCEEDED")


def test_feed_generation_refunds_when_persistence_fails(monkeypatch: MonkeyPatch) -> None:
    events: list[str] = []
    async def generate(self: object, payload: object, owner_id: object, finalize_credit: bool = True) -> GenerateApiResult:
        return GenerateApiResult(200, {"content": [{"type": "text", "text": '{"text":"저장할 글"}'}]}, uuid4())
    async def refund(self: object, result: GenerateApiResult, owner_id: object, status: str) -> None:
        events.append(status)
    monkeypatch.setattr(GeminiGenerateService, "generate", generate)
    monkeypatch.setattr(GeminiGenerateService, "refund_result", refund)
    service = FeedGenerationService(FailingPosts(), StubUsage(), Settings(gemini_api_key="test"))
    try:
        run(service.generate(uuid4(), "char-1", FeedPostGenerateRequest()))
    except RuntimeError:
        pass
    assert events == ["PERSISTENCE_FAILED"]


def run(coroutine: Coroutine[object, object, GenerateApiResult]) -> GenerateApiResult:
    return asyncio.run(coroutine)
