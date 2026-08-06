from uuid import UUID, uuid4

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import Settings, get_settings
from app.models import MediaAsset, MediaVisibility, User
from app.db.session import get_db_session
from app.repositories.media_assets import MediaAssetRepository
from app.schemas.media import MediaAccessResponse, MediaCompleteResponse, MediaPurposeValue, MediaUploadIntent, MediaUploadIntentResponse
from app.services.media_validation import inspect_image
from app.services.media_storage import MediaStorage, media_storage_key


router = APIRouter(prefix="/media", tags=["media"])


@router.post("/upload-intents", response_model=MediaUploadIntentResponse)
async def create_upload_intent(payload: MediaUploadIntent, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session), settings: Settings = Depends(get_settings)) -> MediaUploadIntentResponse:
    _validate_upload_size(payload, settings)
    repository = MediaAssetRepository(session)
    asset_id = uuid4()
    storage_key = media_storage_key(settings, user.id, asset_id, payload.purpose.value, payload.content_type)
    asset = await repository.create(user, payload, storage_key, _visibility(payload.purpose).value, asset_id)
    upload_url, upload_fields = await MediaStorage(settings).create_upload_form(asset.storage_key, asset.content_type, asset.sha256)
    return MediaUploadIntentResponse(asset_id=asset.id, upload_url=upload_url, upload_fields=upload_fields)


@router.post("/{asset_id}/complete", response_model=MediaCompleteResponse)
async def complete_upload(asset_id: UUID, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session), settings: Settings = Depends(get_settings)) -> MediaCompleteResponse:
    repository = MediaAssetRepository(session)
    asset = await repository.owned(user, asset_id)
    _require_pending(asset.status.value)
    storage = MediaStorage(settings)
    try:
        stored = await storage.head(asset.storage_key)
    except (BotoCoreError, ClientError) as error:
        await repository.mark_rejected(asset)
        raise HTTPException(status_code=400, detail="Uploaded image could not be verified") from error
    try:
        _validate_completed_asset(asset, stored.byte_size, stored.content_type, stored.sha256)
        asset.width, asset.height = inspect_image(await storage.read(asset.storage_key), asset.content_type, settings.media_max_image_pixels)
    except HTTPException:
        await _reject_uploaded_asset(repository, storage, asset)
        raise
    await repository.mark_ready(asset)
    return MediaCompleteResponse(asset_id=asset.id, reference=f"asset:{asset.id}")


@router.get("/{asset_id}/access", response_model=MediaAccessResponse)
async def media_access(asset_id: UUID, request: Request, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> MediaAccessResponse:
    asset = await MediaAssetRepository(session).owned(user, asset_id)
    return MediaAccessResponse(asset_id=asset.id, content_url=str(request.url_for("get_media_content", asset_id=asset.id)))


@router.get("/{asset_id}/content", name="get_media_content")
async def get_media_content(asset_id: UUID, thread_key: str = "", user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session), settings: Settings = Depends(get_settings)) -> StreamingResponse:
    asset = await MediaAssetRepository(session).accessible_ready(user, asset_id, thread_key)
    content = await MediaStorage(settings).read(asset.storage_key)
    return StreamingResponse(iter([content]), media_type=asset.content_type, headers={"Cache-Control": _cache_control(asset.visibility.value), "X-Content-Type-Options": "nosniff"})


def _validate_upload_size(payload: MediaUploadIntent, settings: Settings) -> None:
    if payload.byte_size > settings.media_max_upload_bytes:
        raise HTTPException(status_code=413, detail="Image file is too large")


def _visibility(purpose: MediaPurposeValue) -> MediaVisibility:
    return MediaVisibility.private if purpose == MediaPurposeValue.dm_attachment else MediaVisibility.public


def _require_pending(status_value: str) -> None:
    if status_value != "pending":
        raise HTTPException(status_code=409, detail="Image upload has already been completed")


def _validate_completed_asset(asset: MediaAsset, byte_size: int, content_type: str, checksum: str) -> None:
    expected = base64_sha256(asset.sha256)
    if byte_size != asset.byte_size or content_type != asset.content_type or checksum != expected:
        raise HTTPException(status_code=400, detail="Uploaded image metadata does not match the upload request")


async def _reject_uploaded_asset(repository: MediaAssetRepository, storage: MediaStorage, asset: MediaAsset) -> None:
    await repository.mark_rejected(asset)
    try:
        await storage.delete(asset.storage_key)
    except (BotoCoreError, ClientError):
        return


def base64_sha256(hex_digest: str) -> str:
    import base64
    return base64.b64encode(bytes.fromhex(hex_digest)).decode("ascii")


def _cache_control(visibility: str) -> str:
    return "private, max-age=86400" if visibility == "public" else "private, no-store"
