from fastapi import APIRouter, Depends, Form, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import Settings, get_settings
from app.db.session import get_db_session
from app.models import User, UserProvider
from app.schemas.auth import MeResponse, UserResponse
from app.services.oauth import OAuthService


router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/google/start", status_code=status.HTTP_307_TEMPORARY_REDIRECT)
async def start_google_auth(settings: Settings = Depends(get_settings), session: AsyncSession = Depends(get_db_session)) -> RedirectResponse:
    return RedirectResponse(OAuthService(settings, session).auth_url(UserProvider.google))


@router.get("/apple/start", status_code=status.HTTP_307_TEMPORARY_REDIRECT)
async def start_apple_auth(settings: Settings = Depends(get_settings), session: AsyncSession = Depends(get_db_session)) -> RedirectResponse:
    return RedirectResponse(OAuthService(settings, session).auth_url(UserProvider.apple))


@router.get("/google/callback", status_code=status.HTTP_307_TEMPORARY_REDIRECT)
async def google_callback(code: str, state: str, settings: Settings = Depends(get_settings), session: AsyncSession = Depends(get_db_session)) -> RedirectResponse:
    token = await OAuthService(settings, session).complete(UserProvider.google, code, state)
    return _session_redirect(token, settings)


@router.post("/apple/callback", status_code=status.HTTP_307_TEMPORARY_REDIRECT)
async def apple_callback(code: str = Form(...), state: str = Form(...), settings: Settings = Depends(get_settings), session: AsyncSession = Depends(get_db_session)) -> RedirectResponse:
    token = await OAuthService(settings, session).complete(UserProvider.apple, code, state)
    return _session_redirect(token, settings)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response, settings: Settings = Depends(get_settings)) -> None:
    response.delete_cookie(settings.auth_cookie_name, path="/")


@router.get("/me", response_model=MeResponse, summary="Get current user")
async def get_me(user: User = Depends(get_current_user)) -> MeResponse:
    profile = user.profile
    return MeResponse(user=UserResponse.model_validate(user), display_name=profile.display_name, onboarded=profile.onboarded)


def _session_redirect(token: str, settings: Settings) -> RedirectResponse:
    response = RedirectResponse("/app", status_code=status.HTTP_307_TEMPORARY_REDIRECT)
    response.set_cookie(settings.auth_cookie_name, token, httponly=True, secure=settings.auth_cookie_secure, samesite="lax", max_age=settings.auth_session_ttl_seconds, path="/")
    return response
