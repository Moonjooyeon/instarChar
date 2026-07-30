from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.character_handles import validate_character_handle
from app.core.config import Settings, get_settings
from app.db.session import get_db_session
from app.models import User
from app.repositories.ai_usage import AiUsageRepository
from app.repositories.character_posts import CharacterPostsRepository
from app.repositories.characters import CharacterRepository
from app.repositories.profile_state import ProfileStateRepository
from app.schemas.character_posts import AutoPostUpdate, CharacterPostsResponse, CharacterPostsUpdate, FeedPostGenerateRequest
from app.schemas.characters import CharacterHandleAvailabilityResponse, CharacterWrite, CharacterWriteResponse
from app.services.feed_generation import FeedGenerationService


router = APIRouter(prefix="/characters", tags=["characters"])


@router.get("/handle-availability", response_model=CharacterHandleAvailabilityResponse)
async def get_character_handle_availability(handle: str, exclude_source_account_id: str = "", user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> CharacterHandleAvailabilityResponse:
    try:
        normalized = validate_character_handle(handle)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return await CharacterRepository(session).availability(user, normalized, exclude_source_account_id)


@router.put("/{source_account_id}", response_model=CharacterWriteResponse)
async def save_character(source_account_id: str, payload: CharacterWrite, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> CharacterWriteResponse:
    return await CharacterRepository(session).save(user, source_account_id, payload)


@router.get("/{source_account_id}/posts", response_model=CharacterPostsResponse)
async def get_character_posts(source_account_id: str, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> CharacterPostsResponse:
    return await CharacterPostsRepository(session).get(user, source_account_id)


@router.put("/{source_account_id}/posts", response_model=CharacterPostsResponse)
async def save_character_posts(source_account_id: str, payload: CharacterPostsUpdate, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> CharacterPostsResponse:
    return await CharacterPostsRepository(session).save(user, source_account_id, payload)


@router.patch("/{source_account_id}/auto-post", response_model=CharacterPostsResponse)
async def update_auto_post(source_account_id: str, payload: AutoPostUpdate, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> CharacterPostsResponse:
    return await CharacterPostsRepository(session).update_auto_post(user, source_account_id, payload)


@router.post("/{source_account_id}/posts/generate")
async def generate_character_post(source_account_id: str, payload: FeedPostGenerateRequest, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session), settings: Settings = Depends(get_settings)) -> JSONResponse:
    service = FeedGenerationService(CharacterPostsRepository(session), AiUsageRepository(session), settings)
    result = await service.generate(user.id, source_account_id, payload)
    return JSONResponse(status_code=result.status_code, content=result.body)


@router.delete("/{source_account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_character_data(source_account_id: str, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> None:
    await ProfileStateRepository(session).delete_character_data(user, source_account_id)
