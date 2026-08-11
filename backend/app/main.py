import asyncio
import logging
from contextlib import asynccontextmanager, suppress
from collections.abc import AsyncIterator
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from app.api.v1 import api_router
from app.core.config import get_settings
from app.core.credit_products import validate_toss_iap_configuration
from app.core.errors import AppError
from app.db.session import AsyncSessionLocal
from app.services.auto_post_scheduler import AutoPostScheduler
from app.services.account_deletion_scheduler import AccountDeletionScheduler
from app.services.credit_purchase_scheduler import CreditPurchaseScheduler


settings = get_settings()
logger = logging.getLogger(__name__)
legal_directory = Path(__file__).resolve().parent / "legal"
public_directory = Path(__file__).resolve().parent / "public"


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    validate_toss_iap_configuration(settings)
    tasks = _background_tasks()
    yield
    await _cancel_tasks(tasks)


def _background_tasks() -> list[asyncio.Task[None]]:
    tasks: list[asyncio.Task[None]] = []
    if settings.auto_post_scheduler_enabled:
        tasks.append(asyncio.create_task(AutoPostScheduler(settings, AsyncSessionLocal).run()))
    if settings.account_deletion_scheduler_enabled:
        tasks.append(asyncio.create_task(AccountDeletionScheduler(settings, AsyncSessionLocal).run()))
    if settings.toss_iap_enabled and settings.toss_iap_reconciliation_enabled:
        tasks.append(asyncio.create_task(CreditPurchaseScheduler(settings, AsyncSessionLocal).run()))
    return tasks


async def _cancel_tasks(tasks: list[asyncio.Task[None]]) -> None:
    for task in tasks:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_origin_regex=settings.toss_origin_regex,
)


@app.get("/health", tags=["system"], summary="Health check")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/privacy/", include_in_schema=False)
async def privacy_policy() -> FileResponse:
    return FileResponse(legal_directory / "privacy.html")


@app.get("/terms/", include_in_schema=False)
async def terms_of_service() -> FileResponse:
    return FileResponse(legal_directory / "terms.html")


@app.get("/account-deletion/", include_in_schema=False)
async def account_deletion() -> FileResponse:
    return FileResponse(legal_directory / "account-deletion.html")


@app.get("/legal.css", include_in_schema=False)
async def legal_styles() -> FileResponse:
    return FileResponse(legal_directory / "legal.css", media_type="text/css")


@app.get("/brand-icon.png", include_in_schema=False)
async def brand_icon() -> FileResponse:
    return FileResponse(public_directory / "brand-icon.png", media_type="image/png")


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
