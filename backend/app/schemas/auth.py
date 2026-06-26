from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models import UserProvider


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    email: EmailStr
    provider: UserProvider


class MeResponse(BaseModel):
    user: UserResponse
    display_name: str
    onboarded: bool


class OAuthCallbackResult(BaseModel):
    user_id: UUID
    redirect_url: str = "/app"
