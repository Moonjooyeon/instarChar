from __future__ import annotations

import asyncio
import base64
from dataclasses import dataclass
from uuid import UUID

import boto3
from botocore.client import BaseClient

from app.core.config import Settings
from app.core.errors import ServiceUnavailableError

MULTIPART_FORM_OVERHEAD_BYTES = 64 * 1024


@dataclass(frozen=True)
class StoredMediaObject:
    byte_size: int
    content_type: str
    sha256: str


class MediaStorage:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def create_upload_form(self, key: str, content_type: str, checksum: str) -> tuple[str, dict[str, str]]:
        return await asyncio.to_thread(self._create_upload_form, key, content_type, checksum)

    async def head(self, key: str) -> StoredMediaObject:
        return await asyncio.to_thread(self._head, key)

    async def read(self, key: str) -> bytes:
        return await asyncio.to_thread(self._read, key)

    async def delete(self, key: str) -> None:
        await asyncio.to_thread(self._delete, key)

    def _create_upload_form(self, key: str, content_type: str, checksum: str) -> tuple[str, dict[str, str]]:
        checksum_base64 = base64.b64encode(bytes.fromhex(checksum)).decode("ascii")
        fields = _upload_fields(content_type, checksum_base64)
        response = self._client().generate_presigned_post(self._bucket(), key, Fields=fields, Conditions=_upload_conditions(fields, self.settings.media_max_upload_bytes + MULTIPART_FORM_OVERHEAD_BYTES), ExpiresIn=self.settings.s3_presign_expires_seconds)
        return str(response["url"]), {str(name): str(value) for name, value in dict(response["fields"]).items()}

    def _head(self, key: str) -> StoredMediaObject:
        response = self._client().head_object(Bucket=self._bucket(), Key=key, ChecksumMode="ENABLED")
        return StoredMediaObject(int(response["ContentLength"]), str(response.get("ContentType") or ""), str(response.get("ChecksumSHA256") or ""))

    def _read(self, key: str) -> bytes:
        response = self._client().get_object(Bucket=self._bucket(), Key=key)
        return response["Body"].read()

    def _delete(self, key: str) -> None:
        self._client().delete_object(Bucket=self._bucket(), Key=key)

    def _client(self) -> BaseClient:
        self._require_configuration()
        return boto3.client("s3", region_name=self.settings.s3_region, aws_access_key_id=self.settings.s3_access_key_id, aws_secret_access_key=self.settings.s3_secret_access_key)

    def _bucket(self) -> str:
        self._require_configuration()
        return self.settings.s3_bucket

    def _require_configuration(self) -> None:
        if not all((self.settings.s3_bucket, self.settings.s3_region, self.settings.s3_access_key_id, self.settings.s3_secret_access_key)):
            raise ServiceUnavailableError("Image storage is not configured")


def media_storage_key(settings: Settings, owner_id: UUID, asset_id: UUID, purpose: str, content_type: str) -> str:
    extension = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[content_type]
    prefix = settings.s3_prefix.strip("/") or "alive"
    return f"{prefix}/users/{owner_id}/{purpose}/{asset_id}.{extension}"


def _upload_fields(content_type: str, checksum: str) -> dict[str, str]:
    return {"Content-Type": content_type, "success_action_status": "201", "x-amz-checksum-algorithm": "SHA256", "x-amz-checksum-sha256": checksum}


def _upload_conditions(fields: dict[str, str], max_bytes: int) -> list[object]:
    return [{name: value} for name, value in fields.items()] + [["content-length-range", 1, max_bytes]]
