from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


JsonMap = dict[str, object]


class SharedCharacterUpdate(BaseModel):
    owner_name: str = "user"
    name: str
    handle: str = ""
    persona: str = ""
    tags: list[str] = Field(default_factory=list)
    character: JsonMap = Field(default_factory=dict)


class ShareIdResponse(BaseModel):
    id: Optional[UUID] = None


class DiscoverCharacter(BaseModel):
    id: str
    sharedId: str = ""
    ownerId: UUID
    sourceAccountId: str
    owner: str
    ownerName: str
    external: bool = True
    shared: bool = False
    autoSynced: bool = False
    name: str
    handle: str = ""
    persona: str = ""
    tags: list[object] = Field(default_factory=list)
    posts: list[object] = Field(default_factory=list)
    gallery: list[object] = Field(default_factory=list)
    following: list[object] = Field(default_factory=list)
    character: JsonMap = Field(default_factory=dict)


class DiscoverResponse(BaseModel):
    characters: list[DiscoverCharacter]


class FollowerCountsResponse(BaseModel):
    counts: dict[UUID, int]


class FollowRequest(BaseModel):
    follower_name: str = "user"
    follower_account_id: str
    follower_character: JsonMap = Field(default_factory=dict)


class FollowSnapshot(FollowRequest):
    target_shared_character_id: UUID


class FollowSnapshotRequest(BaseModel):
    rows: list[FollowSnapshot] = Field(default_factory=list)


class FollowResponse(BaseModel):
    ok: bool


class FollowerRow(BaseModel):
    id: str
    shared: bool = False
    sharedId: str = ""
    ownerId: UUID
    sourceAccountId: str
    name: str
    handle: str = ""
    owner: str
    ownerName: str
    followerAccountId: str
    followedAt: Optional[datetime] = None
    character: JsonMap = Field(default_factory=dict)


class FollowersResponse(BaseModel):
    rows: list[FollowerRow]


class RelationshipFollowBackRequest(BaseModel):
    follower_shared_character_id: UUID
