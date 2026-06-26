from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import api_router
from app.core.config import get_settings
from app.core.errors import AppError


settings = get_settings()
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
