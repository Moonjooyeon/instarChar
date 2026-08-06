from __future__ import annotations

import base64
from uuid import UUID

from app.core.errors import BadRequestError
from app.core.config import Settings
from app.models import User
from app.repositories.media_assets import MediaAssetRepository
from app.schemas.ai import GenerateMessage, GenerateRequest
from app.services.media_storage import MediaStorage


ASSET_PREFIX = "asset:"


async def resolve_media_references(payload: GenerateRequest, user: User, repository: MediaAssetRepository, settings: Settings) -> GenerateRequest:
    cache: dict[str, str] = {}
    messages = [await _resolve_message(message, user, repository, settings, cache, payload.media_thread_key) for message in payload.messages]
    return payload.model_copy(update={"messages": messages})


async def _resolve_message(message: GenerateMessage, user: User, repository: MediaAssetRepository, settings: Settings, cache: dict[str, str], thread_key: str) -> GenerateMessage:
    content = await _resolve_content(message.content, user, repository, settings, cache, thread_key)
    return message.model_copy(update={"content": content})


async def _resolve_content(content: object, user: User, repository: MediaAssetRepository, settings: Settings, cache: dict[str, str], thread_key: str) -> object:
    if not isinstance(content, list):
        return content
    return [await _resolve_part(part, user, repository, settings, cache, thread_key) for part in content]


async def _resolve_part(part: object, user: User, repository: MediaAssetRepository, settings: Settings, cache: dict[str, str], thread_key: str) -> object:
    if not isinstance(part, dict) or part.get("type") != "image_url":
        return part
    value = part.get("image_url")
    url = value.get("url") if isinstance(value, dict) else ""
    if not isinstance(url, str) or not url.startswith(ASSET_PREFIX):
        return part
    return _replace_image_url(part, await _asset_data_url(url, user, repository, settings, cache, thread_key))


async def _asset_data_url(reference: str, user: User, repository: MediaAssetRepository, settings: Settings, cache: dict[str, str], thread_key: str) -> str:
    if reference in cache:
        return cache[reference]
    asset = await repository.accessible_ready(user, _asset_id(reference), thread_key)
    content = await MediaStorage(settings).read(asset.storage_key)
    value = f"data:{asset.content_type};base64,{base64.b64encode(content).decode('ascii')}"
    cache[reference] = value
    return value


def _asset_id(reference: str) -> UUID:
    try:
        return UUID(reference.removeprefix(ASSET_PREFIX))
    except ValueError as error:
        raise BadRequestError("Invalid image asset reference") from error


def _replace_image_url(part: dict[object, object], url: str) -> dict[object, object]:
    image_url = part.get("image_url")
    if not isinstance(image_url, dict):
        raise BadRequestError("Invalid image asset reference")
    return {**part, "image_url": {**image_url, "url": url}}
