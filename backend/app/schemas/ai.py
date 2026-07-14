from pydantic import BaseModel, Field


class GenerateMessage(BaseModel):
    role: str
    content: object = ""


class GenerateRequest(BaseModel):
    flow: str = ""
    max_tokens: int = 2048
    messages: list[GenerateMessage] = Field(default_factory=list)
    model: str = ""
    system: str = ""
