from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.credit_policy import resolve_flow
from app.core.ai_assist_policy import AssistKind


class GenerateMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: object = ""


class GenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    flow: str = Field(max_length=64)
    idempotency_key: str = Field(min_length=8, max_length=180)
    max_tokens: int = Field(default=2048, ge=1, le=4096)
    media_thread_key: str = Field(default="", max_length=500)
    messages: list[GenerateMessage] = Field(default_factory=list, max_length=100)
    model: str = Field(default="", max_length=64, exclude=True)
    system: str = Field(default="", max_length=50000)

    @field_validator("flow")
    @classmethod
    def validate_flow(cls, value: str) -> str:
        resolve_flow(value)
        return value.strip().lower()


class AssistGenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: AssistKind
    idempotency_key: str = Field(min_length=8, max_length=180)
    context: str = Field(min_length=1, max_length=14000)
    messages: list[GenerateMessage] = Field(min_length=1, max_length=1)
