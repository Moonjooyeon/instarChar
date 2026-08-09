from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.core.credit_policy import resolve_public_flow


class GenerateMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: object = ""


class GenerateRequest(BaseModel):
    flow: str = Field(max_length=64)
    idempotency_key: str = Field(default="", max_length=180)
    max_tokens: int = Field(default=2048, ge=1, le=4096)
    media_thread_key: str = Field(default="", max_length=500)
    messages: list[GenerateMessage] = Field(default_factory=list, max_length=100)
    model: str = Field(default="", max_length=64)
    system: str = Field(default="", max_length=50000)

    @field_validator("flow")
    @classmethod
    def validate_flow(cls, value: str) -> str:
        resolve_public_flow(value)
        return value.strip().lower()
