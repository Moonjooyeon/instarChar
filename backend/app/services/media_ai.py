from __future__ import annotations

import base64
import binascii
import re
from uuid import UUID

from app.core.errors import BadRequestError
from app.core.config import Settings
from app.models import User
from app.repositories.media_assets import MediaAssetRepository
from app.schemas.ai import GenerateMessage, GenerateRequest
from app.services.media_storage import MediaStorage


ASSET_PREFIX = "asset:"
DATA_URL_PATTERN = re.compile(r"^data:([^;,]+);base64,(.+)$")
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGES_PER_REQUEST = 4


async def resolve_media_references(payload: GenerateRequest, user: User, repository: MediaAssetRepository, settings: Settings) -> GenerateRequest:
    cache: dict[str, str] = {}
    messages = [await _resolve_message(message, user, repository, settings, cache, payload.media_thread_key) for message in payload.messages]
    _validate_image_count(messages)
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
    if not isinstance(url, str):
        raise BadRequestError("Invalid image reference")
    if url.startswith("data:"):
        _validate_inline_image(url, settings.media_max_upload_bytes)
        return part
    if not url.startswith(ASSET_PREFIX):
        raise BadRequestError("Invalid image reference")
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


def _validate_inline_image(url: str, max_bytes: int) -> None:
    match = DATA_URL_PATTERN.match(url)
    if not match or match.group(1) not in ALLOWED_IMAGE_TYPES:
        raise BadRequestError("Only JPG, PNG, and WebP images are supported")
    encoded = match.group(2)
    if len(encoded) > ((max_bytes + 2) // 3) * 4:
        raise BadRequestError("Image is too large")
    try:
        decoded = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as error:
        raise BadRequestError("Invalid image data") from error
    if len(decoded) > max_bytes:
        raise BadRequestError("Image is too large")
    if not _matches_image_signature(match.group(1), decoded):
        raise BadRequestError("Image content does not match its type")


def _matches_image_signature(content_type: str, content: bytes) -> bool:
    if content_type == "image/jpeg":
        return content.startswith(b"\xff\xd8\xff")
    if content_type == "image/png":
        return content.startswith(b"\x89PNG\r\n\x1a\n")
    return content.startswith(b"RIFF") and len(content) >= 12 and content[8:12] == b"WEBP"


def _validate_image_count(messages: list[GenerateMessage]) -> None:
    count = sum(_message_image_count(message) for message in messages)
    if count > MAX_IMAGES_PER_REQUEST:
        raise BadRequestError("Too many images in one AI request")


def _message_image_count(message: GenerateMessage) -> int:
    if not isinstance(message.content, list):
        return 0
    return sum(1 for part in message.content if isinstance(part, dict) and part.get("type") == "image_url")
