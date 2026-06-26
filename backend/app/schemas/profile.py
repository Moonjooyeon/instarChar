from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


JsonMap = dict[str, object]


class ProfileStateUpdate(BaseModel):
    display_name: str = ""
    onboarded: bool = False
    app_state: JsonMap = Field(default_factory=dict)


class OnboardingUpdate(BaseModel):
    display_name: str


class CharacterState(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    source_account_id: str
    name: str = ""
    handle: str = ""
    character: JsonMap = Field(default_factory=dict)
    gallery: list[object] = Field(default_factory=list)
    posts: list[object] = Field(default_factory=list)
    following: list[object] = Field(default_factory=list)


class PersonaState(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    persona_id: str
    name: str = ""
    persona: JsonMap = Field(default_factory=dict)


class DmThreadState(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    thread_key: str
    messages: list[object] = Field(default_factory=list)
    world_pref: JsonMap = Field(default_factory=dict)


class SharedDmThreadState(DmThreadState):
    participant_user_ids: list[UUID] = Field(default_factory=list)
    participant_labels: list[str] = Field(default_factory=list)
    created_by: Optional[UUID] = None


class StructuredStateUpdate(BaseModel):
    characters: list[CharacterState] = Field(default_factory=list)
    personas: list[PersonaState] = Field(default_factory=list)
    dm_threads: list[DmThreadState] = Field(default_factory=list)
    shared_dm_threads: list[SharedDmThreadState] = Field(default_factory=list)


class ProfileStateResponse(ProfileStateUpdate, StructuredStateUpdate):
    pass
