from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

from app.core.character_handles import validate_character_handle


JsonMap = dict[str, object]


class CharacterHandleAvailabilityResponse(BaseModel):
    handle: str
    available: bool


class CharacterWrite(BaseModel):
    name: str
    handle: str
    character: JsonMap = Field(default_factory=dict)
    gallery: list[object] = Field(default_factory=list)
    following: list[object] = Field(default_factory=list)

    @field_validator("handle")
    @classmethod
    def normalize_handle(cls, value: str) -> str:
        return validate_character_handle(value)


class CharacterWriteResponse(CharacterWrite):
    source_account_id: str
