from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

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


class NativeOAuthExchangeRequest(BaseModel):
    code: str


class NativeAppleLoginRequest(BaseModel):
    authorization_code: str = Field(min_length=1, max_length=4096)
    identity_token: str = Field(min_length=1, max_length=8192)
    nonce: str = Field(min_length=16, max_length=128)
    display_name: str = Field(default="", max_length=120)


class AppleNotificationRequest(BaseModel):
    payload: str = Field(min_length=1, max_length=16384)


class OAuthCallbackResult(BaseModel):
    user_id: UUID
    redirect_url: str = "/app"
