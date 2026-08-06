from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class MediaPurposeValue(str, Enum):
    profile_avatar = "profile_avatar"
    profile_header = "profile_header"
    gallery = "gallery"
    feed_post = "feed_post"
    dm_attachment = "dm_attachment"


class MediaUploadIntent(BaseModel):
    purpose: MediaPurposeValue
    content_type: str
    byte_size: int = Field(gt=0)
    sha256: str
    source_account_id: str = ""

    @field_validator("content_type")
    @classmethod
    def validate_content_type(cls, value: str) -> str:
        allowed = {"image/jpeg", "image/png", "image/webp"}
        if value not in allowed:
            raise ValueError("Unsupported image type")
        return value

    @field_validator("sha256")
    @classmethod
    def validate_sha256(cls, value: str) -> str:
        if len(value) != 64 or any(char not in "0123456789abcdef" for char in value.lower()):
            raise ValueError("sha256 must be a lowercase hex digest")
        return value.lower()


class MediaUploadIntentResponse(BaseModel):
    asset_id: UUID
    upload_fields: dict[str, str]
    upload_url: str


class MediaCompleteResponse(BaseModel):
    asset_id: UUID
    reference: str


class MediaAccessResponse(BaseModel):
    asset_id: UUID
    content_url: str
