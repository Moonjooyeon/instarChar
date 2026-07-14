import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import api_router
from app.core.config import get_settings
from app.core.errors import AppError


settings = get_settings()
logger = logging.getLogger(__name__)
app = FastAPI(title=settings.app_name)
app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["system"], summary="Health check")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"error": exc.code, "message": exc.message})


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled API error: %s", exc)
    return JSONResponse(status_code=500, content={"error": "INTERNAL_SERVER_ERROR", "message": "Internal server error"}, headers=cors_error_headers(request))


def cors_error_headers(request: Request) -> dict[str, str]:
    origin = request.headers.get("origin", "")
    if not origin or origin not in settings.allowed_origins:
        return {}
    return {"Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true", "Vary": "Origin"}
