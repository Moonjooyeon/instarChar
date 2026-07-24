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
