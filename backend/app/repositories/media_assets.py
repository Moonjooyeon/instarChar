from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequestError, NotFoundError
from app.models import MediaAsset, MediaStatus, SharedDmThread, User
from app.schemas.media import MediaUploadIntent
from app.services.media_references import media_asset_ids


class MediaAssetRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, user: User, payload: MediaUploadIntent, storage_key: str, visibility: str, asset_id: UUID) -> MediaAsset:
        asset = MediaAsset(id=asset_id, owner_id=user.id, source_account_id=payload.source_account_id or None, purpose=payload.purpose.value, visibility=visibility, storage_key=storage_key, content_type=payload.content_type, byte_size=payload.byte_size, sha256=payload.sha256)
        self.session.add(asset)
        await self.session.flush()
        await self.session.commit()
        return asset

    async def list_for_owner(self, owner_id: UUID) -> list[MediaAsset]:
        result = await self.session.execute(select(MediaAsset).where(MediaAsset.owner_id == owner_id))
        return list(result.scalars().all())

    async def owned(self, user: User, asset_id: UUID) -> MediaAsset:
        asset = await self._asset(asset_id)
        if asset.owner_id != user.id:
            raise NotFoundError("Media asset not found")
        return asset

    async def ready(self, asset_id: UUID) -> MediaAsset:
        asset = await self._asset(asset_id)
        if asset.status != MediaStatus.ready:
            raise NotFoundError("Media asset not ready")
        return asset

    async def accessible_ready(self, user: User, asset_id: UUID, thread_key: str = "") -> MediaAsset:
        asset = await self.ready(asset_id)
        if asset.visibility.value == "public" or asset.owner_id == user.id:
            return asset
        if await self._shared_thread_has_asset(user, thread_key, asset_id):
            return asset
        raise NotFoundError("Media asset not found")

    async def require_owned_ready_references(self, user: User, value: object, purposes: set[str], source_account_id: str = "") -> None:
        assets = await self._reference_assets(value)
        for asset in assets:
            self._require_owned_asset(user, asset, purposes, source_account_id)

    async def require_shared_dm_references(self, user: User, thread_key: str, value: object) -> None:
        assets = await self._reference_assets(value)
        for asset in assets:
            await self._require_shared_dm_asset(user, thread_key, asset)

    async def mark_ready(self, asset: MediaAsset) -> MediaAsset:
        asset.status = MediaStatus.ready
        await self.session.commit()
        return asset

    async def mark_rejected(self, asset: MediaAsset) -> None:
        asset.status = MediaStatus.rejected
        await self.session.commit()

    async def _asset(self, asset_id: UUID) -> MediaAsset:
        result = await self.session.execute(select(MediaAsset).where(MediaAsset.id == asset_id))
        asset = result.scalar_one_or_none()
        if not asset:
            raise NotFoundError("Media asset not found")
        return asset

    async def _reference_assets(self, value: object) -> list[MediaAsset]:
        asset_ids = media_asset_ids(value)
        if not asset_ids:
            return []
        result = await self.session.execute(select(MediaAsset).where(MediaAsset.id.in_(asset_ids)))
        assets = list(result.scalars().all())
        if len(assets) != len(asset_ids):
            raise BadRequestError("Image asset not found")
        return assets

    def _require_owned_asset(self, user: User, asset: MediaAsset, purposes: set[str], source_account_id: str) -> None:
        if asset.owner_id != user.id or asset.status != MediaStatus.ready:
            raise BadRequestError("Image asset is not ready for this account")
        if asset.purpose.value not in purposes:
            raise BadRequestError("Image asset cannot be used here")
        if source_account_id and asset.source_account_id != source_account_id:
            raise BadRequestError("Image asset belongs to another character")

    async def _require_shared_dm_asset(self, user: User, thread_key: str, asset: MediaAsset) -> None:
        if asset.status != MediaStatus.ready or asset.purpose.value != "dm_attachment":
            raise BadRequestError("Image asset cannot be used in this conversation")
        if asset.owner_id == user.id or await self._shared_thread_has_asset(user, thread_key, asset.id):
            return
        raise BadRequestError("Image asset is not available in this conversation")

    async def _shared_thread_has_asset(self, user: User, thread_key: str, asset_id: UUID) -> bool:
        if not thread_key:
            return False
        result = await self.session.execute(select(SharedDmThread).where(SharedDmThread.thread_key == thread_key))
        thread = result.scalar_one_or_none()
        return bool(thread and user.id in set(thread.participant_user_ids or []) and _contains_reference(thread.messages, f"asset:{asset_id}"))


def _contains_reference(value: object, reference: str) -> bool:
    if isinstance(value, str):
        return value == reference
    if isinstance(value, list):
        return any(_contains_reference(item, reference) for item in value)
    if isinstance(value, dict):
        return any(_contains_reference(item, reference) for item in value.values())
    return False
