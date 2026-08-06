from io import BytesIO
from uuid import UUID

import pytest
from PIL import Image
from pydantic import ValidationError

from app.core.config import Settings
from app.core.errors import BadRequestError
from app.schemas.media import MediaUploadIntent
from app.services.media_references import media_asset_ids
from app.services.media_storage import MULTIPART_FORM_OVERHEAD_BYTES, MediaStorage, media_storage_key
from app.services.media_validation import inspect_image


def test_media_storage_key_uses_alive_prefix() -> None:
    settings = Settings(s3_prefix="alive")
    key = media_storage_key(settings, UUID("00000000-0000-0000-0000-000000000001"), UUID("00000000-0000-0000-0000-000000000002"), "gallery", "image/webp")
    assert key == "alive/users/00000000-0000-0000-0000-000000000001/gallery/00000000-0000-0000-0000-000000000002.webp"


def test_upload_intent_rejects_invalid_image_type() -> None:
    with pytest.raises(ValidationError, match="Unsupported image type"):
        MediaUploadIntent(purpose="gallery", content_type="image/svg+xml", byte_size=1, sha256="a" * 64)


def test_presigned_upload_limits_size_and_binds_checksum(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict[str, object]] = []
    settings = Settings(s3_bucket="game-asset-2026", s3_region="ap-northeast-2", s3_access_key_id="key", s3_secret_access_key="secret")
    monkeypatch.setattr("app.services.media_storage.boto3.client", lambda *_args, **_kwargs: FakeS3Client(calls))
    url, fields = MediaStorage(settings)._create_upload_form("alive/image.webp", "image/webp", "a" * 64)
    assert url == "https://upload.example"
    assert fields["Content-Type"] == "image/webp"
    assert ["content-length-range", 1, 10 * 1024 * 1024 + MULTIPART_FORM_OVERHEAD_BYTES] in calls[0]["Conditions"]
    assert fields["x-amz-checksum-sha256"] == "qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqo="


def test_media_asset_ids_collects_only_image_references() -> None:
    asset_id = UUID("00000000-0000-0000-0000-000000000001")
    value = {"image": f"asset:{asset_id}", "text": "asset:looks-like-text", "nested": [f"asset:{asset_id}"]}
    assert media_asset_ids(value) == {asset_id}


def test_image_validation_checks_actual_format() -> None:
    png = _png_bytes()
    assert inspect_image(png, "image/png", 1) == (1, 1)
    with pytest.raises(BadRequestError, match="does not match"):
        inspect_image(png, "image/jpeg", 1)


def _png_bytes() -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (1, 1)).save(buffer, format="PNG")
    return buffer.getvalue()


class FakeS3Client:
    def __init__(self, calls: list[dict[str, object]]) -> None:
        self.calls = calls

    def generate_presigned_post(self, bucket: str, key: str, **kwargs: object) -> dict[str, object]:
        fields = dict(kwargs["Fields"])
        fields["key"] = key
        self.calls.append({"Bucket": bucket, "Key": key, **kwargs})
        return {"url": "https://upload.example", "fields": fields}
