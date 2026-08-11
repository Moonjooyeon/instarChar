from typing import Literal

from pydantic import BaseModel, Field


FeedKind = Literal["timeline", "recommendations"]


class FeedPageItem(BaseModel):
    author_character_id: str
    author_handle: str = ""
    author_name: str
    author_owner_id: str
    author_shared_id: str
    post_id: str
    post: dict[str, object] = Field(default_factory=dict)
    recommendation_reason: str = ""


class FeedPage(BaseModel):
    has_more: bool
    items: list[FeedPageItem] = Field(default_factory=list)
    next_cursor: str = ""
