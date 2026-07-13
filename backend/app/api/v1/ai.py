from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from app.core.config import Settings, get_settings
from app.schemas.ai import GenerateRequest
from app.services.ai import GeminiGenerateService


router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/generate")
async def generate_content(payload: GenerateRequest, request: Request, settings: Settings = Depends(get_settings)) -> JSONResponse:
    result = await GeminiGenerateService(settings).generate(payload, request)
    return JSONResponse(status_code=result.status_code, content=result.body)
