from uuid import UUID

from pydantic import BaseModel, Field


class PostLikeTarget(BaseModel):
    target_character_id: UUID
    post_id: str = Field(min_length=1, max_length=120)


class PostLikesQuery(BaseModel):
    liker_account_id: str = Field(min_length=1, max_length=120)
    targets: list[PostLikeTarget] = Field(default_factory=list, max_length=100)


class PostLikeUpdate(PostLikeTarget):
    liker_account_id: str = Field(min_length=1, max_length=120)
    liked: bool


class PostLikeItem(PostLikeTarget):
    available: bool
    liked: bool
    likes: int = Field(ge=0)


class PostLikesResponse(BaseModel):
    items: list[PostLikeItem] = Field(default_factory=list)
