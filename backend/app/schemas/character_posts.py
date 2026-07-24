from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


ALLOWED_AUTO_POST_INTERVALS = {900, 1800, 3600}


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
    interval_seconds: int = 900

    @field_validator("interval_seconds")
    @classmethod
    def validate_interval(cls, value: int) -> int:
        if value not in ALLOWED_AUTO_POST_INTERVALS:
            raise ValueError("interval_seconds must be 900, 1800, or 3600")
        return value


class FeedPostGenerateRequest(BaseModel):
    mood: str = "랜덤 / 알아서"
