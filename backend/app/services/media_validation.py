from io import BytesIO

from PIL import Image, UnidentifiedImageError

from app.core.errors import BadRequestError


def inspect_image(content: bytes, expected_content_type: str, max_pixels: int) -> tuple[int, int]:
    try:
        with Image.open(BytesIO(content)) as image:
            width, height = image.size
            _validate_image(image.format or "", width, height, expected_content_type, max_pixels)
            image.verify()
    except (Image.DecompressionBombError, OSError, UnidentifiedImageError) as error:
        raise BadRequestError("Uploaded file is not a valid image") from error
    return width, height


def _validate_image(image_format: str, width: int, height: int, expected_content_type: str, max_pixels: int) -> None:
    expected_format = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}[expected_content_type]
    if image_format != expected_format:
        raise BadRequestError("Uploaded image type does not match the upload request")
    if width < 1 or height < 1 or width * height > max_pixels:
        raise BadRequestError("Uploaded image dimensions are too large")
