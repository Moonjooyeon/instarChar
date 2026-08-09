from uuid import UUID

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.errors import ForbiddenError, UnauthorizedError
from app.core.security import verify_session
from app.db.session import get_db_session
from app.models import User, UserAccountStatus, UserModerationStatus
from app.repositories.users import UserRepository


async def get_current_user(
    request: Request,
    settings: Settings = Depends(get_settings),
    session: AsyncSession = Depends(get_db_session),
) -> User:
    alive_session = _request_session_token(request, settings)
    if not alive_session:
        raise UnauthorizedError()
    payload = verify_session(alive_session, settings.auth_secret_key)
    if not payload:
        raise UnauthorizedError()
    return await _load_user(payload.user_id, session, payload.session_version)


def _request_session_token(request: Request, settings: Settings) -> str:
    cookie_token = request.cookies.get(settings.auth_cookie_name)
    if cookie_token:
        return cookie_token
    scheme, _, token = request.headers.get("Authorization", "").partition(" ")
    return token if scheme.lower() == "bearer" else ""


async def _load_user(user_id: UUID, session: AsyncSession, session_version: int | None = None) -> User:
    user = await UserRepository(session).get_by_id(user_id)
    if not user:
        raise UnauthorizedError()
    if user.moderation_status == UserModerationStatus.banned:
        raise ForbiddenError("Account access has been disabled")
    if user.moderation_status == UserModerationStatus.suspended:
        raise ForbiddenError("Account access is temporarily suspended")
    if getattr(user, "account_status", UserAccountStatus.active) == UserAccountStatus.pending_deletion:
        raise UnauthorizedError("Account deletion is pending")
    if session_version is not None and session_version != getattr(user, "session_version", 0):
        raise UnauthorizedError("Session expired")
    if user.auth_revoked_at:
        raise UnauthorizedError("Apple account authorization has been revoked")
    return user
