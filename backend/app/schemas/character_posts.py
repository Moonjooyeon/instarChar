from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


ALLOWED_AUTO_POST_INTERVALS = {3600, 21600, 43200}


class CharacterPostsResponse(BaseModel):
    posts: list[object] = Field(default_factory=list)
    revision: int
    auto_post_enabled: bool
    auto_post_interval_seconds: int
    next_auto_post_at: Optional[datetime] = None
    last_auto_post_at: Optional[datetime] = None
    last_auto_post_error: str = ""
    auto_post_failure_count: int = 0


class CharacterPostsUpdate(BaseModel):
    posts: list[object] = Field(default_factory=list)
    revision: int


class AutoPostUpdate(BaseModel):
    enabled: bool
    interval_seconds: int = 3600

    @field_validator("interval_seconds")
    @classmethod
    def validate_interval(cls, value: int) -> int:
        if value not in ALLOWED_AUTO_POST_INTERVALS:
            raise ValueError("interval_seconds must be 3600, 21600, or 43200")
        return value


class FeedPostGenerateRequest(BaseModel):
    idempotency_key: str = Field(min_length=8, max_length=180)
    mood: str = "랜덤 / 알아서"


class CharacterPostCommentCreate(BaseModel):
    commenter_account_id: str = Field(min_length=1, max_length=120)
    handle: str = Field(default="", max_length=120)
    name: str = Field(min_length=1, max_length=120)
    reply_to: str = Field(default="", max_length=120)
    text: str = Field(min_length=1, max_length=500)


class CharacterPostCommentsResponse(BaseModel):
    comments: list[object] = Field(default_factory=list)
