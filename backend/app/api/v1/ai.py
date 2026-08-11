from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import Settings, get_settings
from app.core.credit_policy import resolve_public_flow
from app.db.session import get_db_session
from app.models import User
from app.repositories.media_assets import MediaAssetRepository
from app.repositories.ai_usage import AiUsageRepository
from app.repositories.credits import CreditRepository
from app.schemas.ai import GenerateRequest
from app.services.ai import MonoGptGeminiGenerateService
from app.services.media_ai import resolve_media_references


router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/generate")
async def generate_content(payload: GenerateRequest, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session), settings: Settings = Depends(get_settings)) -> JSONResponse:
    require_public_flow(payload.flow)
    prepared = await resolve_media_references(payload, user, MediaAssetRepository(session), settings)
    result = await MonoGptGeminiGenerateService(settings, AiUsageRepository(session), CreditRepository(session)).generate(prepared, user.id)
    return JSONResponse(status_code=result.status_code, content=result.body)


def require_public_flow(flow: str) -> None:
    try:
        resolve_public_flow(flow)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
