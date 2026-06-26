from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


JsonMap = dict[str, object]


class DmThreadPayload(BaseModel):
    thread_key: str
    messages: list[object] = Field(default_factory=list)
    world_pref: JsonMap = Field(default_factory=dict)


class SharedDmThreadPayload(DmThreadPayload):
    participant_user_ids: list[UUID] = Field(default_factory=list)
    participant_labels: list[str] = Field(default_factory=list)


class DmThreadResponse(DmThreadPayload):
    model_config = ConfigDict(from_attributes=True)
    id: Optional[UUID] = None


class SharedDmThreadResponse(SharedDmThreadPayload):
    model_config = ConfigDict(from_attributes=True)
    id: Optional[UUID] = None
    created_by: Optional[UUID] = None
