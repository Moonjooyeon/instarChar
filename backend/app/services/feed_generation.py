from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from uuid import UUID
from uuid import uuid4

from app.core.config import Settings
from app.repositories.ai_usage import AiUsageRepository
from app.repositories.character_posts import CharacterPostsRepository
from app.schemas.ai import GenerateMessage, GenerateRequest
from app.schemas.character_posts import FeedPostGenerateRequest
from app.services.ai import GenerateApiResult, GeminiGenerateService


FAILED_POST_PATTERN = re.compile(r"게시글\s*생성\s*실패|API\s*응답이\s*끊|AI\s*응답이\s*잠깐\s*비")


class FeedGenerationService:
    def __init__(self, posts: CharacterPostsRepository, usage: AiUsageRepository, settings: Settings) -> None:
        self.posts = posts
        self.ai = GeminiGenerateService(settings, usage)

    async def generate(self, owner_id: UUID, source_account_id: str, payload: FeedPostGenerateRequest, is_auto: bool = False) -> GenerateApiResult:
        character = await self.posts.owned_character(owner_id, source_account_id)
        request = self._request(character.name, character.character, character.posts, payload.mood)
        result = await self._generate_result(request, owner_id)
        if result.status_code != 200:
            if is_auto:
                await self._record_auto_failure(owner_id, source_account_id, result, character.auto_post_failure_count)
            return result
        post = self._post_from_result(result, payload.mood)
        if not post:
            return GenerateApiResult(500, {"error": "INVALID_POST", "message": "생성된 게시글을 해석할 수 없습니다."})
        state = await self.posts.append_generated_post(owner_id, source_account_id, post, is_auto=is_auto)
        return GenerateApiResult(200, {"post": post, "state": state.model_dump(mode="json")})

    async def _generate_result(self, request: GenerateRequest, owner_id: UUID) -> GenerateApiResult:
        try:
            return await self.ai.generate(request, owner_id)
        except Exception as exc:
            return GenerateApiResult(500, {"error": "GENERATION_FAILED", "message": str(exc)})

    async def _record_auto_failure(self, owner_id: UUID, source_account_id: str, result: GenerateApiResult, failure_count: int) -> None:
        code = str(result.body.get("error") or "GENERATION_FAILED")
        message = str(result.body.get("message") or code)
        retry_at = self._retry_at(code, failure_count)
        await self.posts.record_auto_failure(owner_id, source_account_id, f"{code}: {message}", retry_at)

    def _retry_at(self, code: str, failure_count: int) -> datetime:
        now = datetime.now(timezone.utc)
        if code == "DAILY_LIMIT_EXCEEDED":
            return datetime.combine(now.date() + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
        if code == "MONTHLY_COST_LIMIT_EXCEEDED":
            first_next_month = (now.replace(day=28) + timedelta(days=4)).replace(day=1)
            return first_next_month.replace(hour=0, minute=0, second=0, microsecond=0)
        return now + timedelta(seconds=retry_delay_seconds(failure_count))

    def _request(self, name: str, character: dict[str, object], posts: list[object], mood: str) -> GenerateRequest:
        recent = [self._post_text(item) for item in list(posts or [])[:8]]
        system = "character-feed-post-v1\n캐릭터 설정에 맞는 SNS 글 하나를 JSON 객체로 작성하라. text는 필수이며 photoDesc와 moodDesc는 선택이다. 설명이나 코드펜스 없이 JSON만 출력하라."
        prompt_character = {key: value for key, value in character.items() if key not in {"avatarImg", "headerImg"}}
        prompt = {"name": name, "character": prompt_character, "mood": mood, "recent_posts": [item for item in recent if item]}
        return GenerateRequest(flow="character-feed-post-v1", model="fast", max_tokens=1200, system=system, messages=[GenerateMessage(role="user", content=json.dumps(prompt, ensure_ascii=False))])

    def _post_from_result(self, result: GenerateApiResult, mood: str) -> dict[str, object] | None:
        text = self._result_text(result.body)
        parsed = self._parse_json(text)
        body = str(parsed.get("text") or text).strip()
        if not body or FAILED_POST_PATTERN.search(body):
            return None
        post = {"id": str(uuid4()), "text": body, "mood": mood, "time": datetime.now(timezone.utc).isoformat(), "likes": 0, "liked": False, "comments": []}
        return post | self._optional_fields(parsed)

    def _result_text(self, body: dict[str, object]) -> str:
        content = body.get("content")
        if not isinstance(content, list) or not content or not isinstance(content[0], dict):
            return ""
        return str(content[0].get("text") or "")

    def _parse_json(self, text: str) -> dict[str, object]:
        cleaned = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        try:
            value = json.loads(cleaned)
        except json.JSONDecodeError:
            return {}
        return value if isinstance(value, dict) else {}

    def _optional_fields(self, parsed: dict[str, object]) -> dict[str, object]:
        keys = ("photoDesc", "moodDesc")
        return {key: str(parsed[key]).strip() for key in keys if parsed.get(key)}

    def _post_text(self, value: object) -> str:
        return str(value.get("text") or "") if isinstance(value, dict) else ""


def retry_delay_seconds(failure_count: int) -> int:
    return min(60 * (2 ** max(failure_count, 0)), 900)
