import logging
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from fastapi import APIRouter, Depends, Form, Query, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import Settings, get_settings
from app.core.errors import AppError, BadRequestError
from app.db.session import get_db_session
from app.models import User, UserProvider
from app.schemas.auth import MeResponse, UserResponse
from app.services.oauth import OAuthService


router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


@router.get("/google/start", status_code=status.HTTP_307_TEMPORARY_REDIRECT)
async def start_google_auth(redirect_uri: str = Query(""), return_url: str = Query(""), settings: Settings = Depends(get_settings), session: AsyncSession = Depends(get_db_session)) -> RedirectResponse:
    return _oauth_start_redirect(UserProvider.google, redirect_uri, return_url, settings, session)


@router.get("/apple/start", status_code=status.HTTP_307_TEMPORARY_REDIRECT)
async def start_apple_auth(redirect_uri: str = Query(""), return_url: str = Query(""), settings: Settings = Depends(get_settings), session: AsyncSession = Depends(get_db_session)) -> RedirectResponse:
    return _oauth_start_redirect(UserProvider.apple, redirect_uri, return_url, settings, session)


@router.get("/google/callback", status_code=status.HTTP_307_TEMPORARY_REDIRECT)
async def google_callback(code: str, state: str, settings: Settings = Depends(get_settings), session: AsyncSession = Depends(get_db_session)) -> RedirectResponse:
    return await _complete_oauth_callback(UserProvider.google, code, state, settings, session)


@router.post("/apple/callback", status_code=status.HTTP_307_TEMPORARY_REDIRECT)
async def apple_callback(code: str = Form(...), state: str = Form(...), settings: Settings = Depends(get_settings), session: AsyncSession = Depends(get_db_session)) -> RedirectResponse:
    return await _complete_oauth_callback(UserProvider.apple, code, state, settings, session)


async def _complete_oauth_callback(provider: UserProvider, code: str, state: str, settings: Settings, session: AsyncSession) -> RedirectResponse:
    service = OAuthService(settings, session)
    redirect_url = service.frontend_redirect_url(provider, state)
    try:
        token = await service.complete(provider, code, state)
    except AppError as exc:
        return _oauth_error_redirect(exc, redirect_url)
    except Exception as exc:
        logger.exception("Unexpected OAuth callback error: %s", exc)
        return _oauth_error_redirect(AppError("INTERNAL_SERVER_ERROR", "OAuth login failed", 500), redirect_url)
    return _session_redirect(token, settings, redirect_url)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response, settings: Settings = Depends(get_settings)) -> None:
    response.delete_cookie(settings.auth_cookie_name, path="/")


@router.get("/me", response_model=MeResponse, summary="Get current user")
async def get_me(user: User = Depends(get_current_user)) -> MeResponse:
    profile = user.profile
    display_name = profile.display_name if profile else ""
    onboarded = profile.onboarded if profile else False
    return MeResponse(user=UserResponse.model_validate(user), display_name=display_name, onboarded=onboarded)


def _oauth_start_redirect(provider: UserProvider, redirect_uri: str, return_url: str, settings: Settings, session: AsyncSession) -> RedirectResponse:
    callback_url = _trusted_oauth_callback_url(provider, redirect_uri)
    frontend_url = _trusted_frontend_url(return_url, settings.allowed_origins)
    return RedirectResponse(OAuthService(settings, session).auth_url(provider, callback_url, frontend_url))


def _session_redirect(token: str, settings: Settings, redirect_url: str) -> RedirectResponse:
    response = RedirectResponse(redirect_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)
    response.set_cookie(settings.auth_cookie_name, token, httponly=True, secure=settings.auth_cookie_secure, samesite="lax", max_age=settings.auth_session_ttl_seconds, path="/")
    return response


def _oauth_error_redirect(exc: AppError, redirect_url: str) -> RedirectResponse:
    return RedirectResponse(_frontend_error_url(redirect_url, exc), status_code=status.HTTP_307_TEMPORARY_REDIRECT)


def _frontend_error_url(redirect_url: str, exc: AppError) -> str:
    parts = urlsplit(redirect_url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query["error"] = exc.code
    query["error_description"] = exc.message
    return urlunsplit(parts._replace(query=urlencode(query)))


def _trusted_oauth_callback_url(provider: UserProvider, redirect_uri: str) -> str:
    if not redirect_uri:
        return ""
    parts = urlsplit(redirect_uri)
    if parts.scheme not in {"http", "https"} or not parts.netloc:
        raise BadRequestError("Invalid OAuth redirect URL")
    if parts.path != f"/api/auth/{provider.value}/callback":
        raise BadRequestError("Invalid OAuth redirect URL")
    return redirect_uri


def _trusted_frontend_url(return_url: str, allowed_origins: list[str]) -> str:
    if not return_url:
        return ""
    parts = urlsplit(return_url)
    if parts.scheme not in {"http", "https"} or not parts.netloc:
        raise BadRequestError("Invalid OAuth return URL")
    if _url_origin(return_url) not in {_url_origin(item) for item in allowed_origins}:
        raise BadRequestError("Invalid OAuth return URL")
    return urlunsplit(parts._replace(query="", fragment=""))


def _url_origin(value: str) -> str:
    parts = urlsplit(value)
    return f"{parts.scheme.lower()}://{parts.netloc.lower()}"
