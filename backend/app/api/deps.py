from uuid import UUID

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.errors import UnauthorizedError
from app.core.security import verify_session
from app.db.session import get_db_session
from app.models import User
from app.repositories.users import UserRepository


async def get_current_user(
    request: Request,
    settings: Settings = Depends(get_settings),
    session: AsyncSession = Depends(get_db_session),
) -> User:
    alive_session = request.cookies.get(settings.auth_cookie_name)
    if not alive_session:
        raise UnauthorizedError()
    payload = verify_session(alive_session, settings.auth_secret_key)
    if not payload:
        raise UnauthorizedError()
    return await _load_user(payload.user_id, session)


async def _load_user(user_id: UUID, session: AsyncSession) -> User:
    user = await UserRepository(session).get_by_id(user_id)
    if user:
        return user
    raise UnauthorizedError()
