from collections.abc import Callable
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from types import ModuleType
from typing import cast

import pytest
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def _load_initial_migration() -> ModuleType:
    path = Path(__file__).parents[1] / "migrations/versions/20260626_0001_initial_alive_schema.py"
    spec = spec_from_file_location("initial_alive_schema", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load initial migration")
    migration = module_from_spec(spec)
    spec.loader.exec_module(migration)
    return migration


def _load_migration(filename: str) -> ModuleType:
    path = Path(__file__).parents[1] / f"migrations/versions/{filename}"
    spec = spec_from_file_location(filename.removesuffix(".py"), path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load migration")
    migration = module_from_spec(spec)
    spec.loader.exec_module(migration)
    return migration


def test_initial_user_provider_enum_reuses_existing_type(monkeypatch: pytest.MonkeyPatch) -> None:
    migration = _load_initial_migration()
    created_tables: list[tuple[str, tuple[object, ...]]] = []
    def capture_table(name: str, *columns: object, **_: object) -> None:
        created_tables.append((name, columns))
    monkeypatch.setattr(migration.op, "create_table", capture_table)
    cast(Callable[[], None], migration._create_users)()
    users_columns = next(columns for name, columns in created_tables if name == "users")
    provider = next(column for column in users_columns if isinstance(column, sa.Column) and column.name == "provider")
    assert isinstance(provider.type, postgresql.ENUM)
    assert provider.type.create_type is False


def test_apple_credentials_migration_follows_ugc_safety() -> None:
    migration = _load_migration("20260728_0007_apple_oauth_credentials.py")
    columns = cast(Callable[[], list[object]], migration._credential_columns)()
    names = {column.name for column in columns if isinstance(column, sa.Column)}
    assert migration.down_revision == "20260724_0006"
    assert {"refresh_token_encrypted", "access_token_encrypted", "last_validated_at"} <= names


def test_apple_notification_migration_follows_credentials() -> None:
    migration = _load_migration("20260728_0008_apple_account_notifications.py")
    columns = cast(Callable[[], list[object]], migration._event_columns)()
    names = {column.name for column in columns if isinstance(column, sa.Column)}
    assert migration.down_revision == "20260728_0007"
    assert {"event_id", "event_type", "subject", "payload_hash", "status"} <= names
