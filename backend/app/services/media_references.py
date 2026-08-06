from uuid import UUID

from app.core.errors import BadRequestError


ASSET_PREFIX = "asset:"


def media_asset_ids(value: object) -> set[UUID]:
    asset_ids: set[UUID] = set()
    _collect_asset_ids(value, asset_ids)
    return asset_ids


def _collect_asset_ids(value: object, asset_ids: set[UUID]) -> None:
    if isinstance(value, str):
        _collect_asset_id(value, asset_ids)
        return
    if isinstance(value, list):
        for item in value:
            _collect_asset_ids(item, asset_ids)
        return
    if isinstance(value, dict):
        for item in value.values():
            _collect_asset_ids(item, asset_ids)


def _collect_asset_id(value: str, asset_ids: set[UUID]) -> None:
    if not value.startswith(ASSET_PREFIX) or len(value) != len(ASSET_PREFIX) + 36:
        return
    try:
        asset_ids.add(UUID(value.removeprefix(ASSET_PREFIX)))
    except ValueError as error:
        raise BadRequestError("Invalid image asset reference") from error
