from collections.abc import Callable
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from types import ModuleType
from typing import cast
from unittest.mock import Mock

import pytest
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.sql.schema import SchemaItem


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


def test_character_handle_migration_follows_apple_notifications() -> None:
    migration = _load_migration("20260730_0009_character_handle_uniqueness.py")
    assert migration.down_revision == "20260728_0008"


def test_character_handle_migration_assigns_deterministic_unique_values() -> None:
    migration = _load_migration("20260730_0009_character_handle_uniqueness.py")
    assign = cast(Callable[[list[tuple[object, object, str, str]]], list[tuple[object, object, str, str]]], migration._assign_handles)
    rows = [(1, 10, "one", "Hero"), (2, 20, "two", "@hero"), (3, 30, "three", ""), (4, 40, "four", "admin")]
    assert [row[3] for row in assign(rows)] == ["hero", "hero-2", "character", "admin-2"]


def test_character_handle_migration_types_asyncpg_handle_binds() -> None:
    migration = _load_migration("20260730_0009_character_handle_uniqueness.py")
    update_character = cast(Callable[[sa.Connection, object, str], None], migration._update_character)
    update_snapshots = cast(Callable[[sa.Connection, object, str, str], None], migration._update_snapshots)
    connection = Mock(spec=sa.Connection)
    update_character(connection, 1, "hero")
    update_snapshots(connection, 2, "source", "hero")
    statements = [call.args[0] for call in connection.execute.call_args_list]
    compiled = [statement.compile(dialect=postgresql.asyncpg.dialect()) for statement in statements]
    assert all("::VARCHAR" in str(statement) for statement in compiled)
    assert all(statement.binds["handle"].type.length == 24 for statement in compiled)


def test_credit_wallet_migration_follows_session_version(monkeypatch: pytest.MonkeyPatch) -> None:
    migration = _load_migration("20260809_0014_credit_wallet.py")
    tables: list[str] = []
    monkeypatch.setattr(migration.op, "create_table", lambda name, *args, **kwargs: tables.append(name))
    monkeypatch.setattr(migration.op, "create_index", lambda *args, **kwargs: None)
    cast(Callable[[], None], migration.upgrade)()
    assert migration.down_revision == "20260809_0013"
    assert tables == ["credit_accounts", "energy_accounts", "credit_ledger_entries", "reward_grants", "credit_usages"]


def test_credit_wallet_grants_are_unique_per_user_event(monkeypatch: pytest.MonkeyPatch) -> None:
    migration = _load_migration("20260809_0014_credit_wallet.py")
    tables: dict[str, tuple[object, ...]] = {}
    monkeypatch.setattr(migration.op, "create_table", lambda name, *args, **kwargs: tables.update({name: args}))
    monkeypatch.setattr(migration.op, "create_index", lambda *args, **kwargs: None)
    cast(Callable[[], None], migration.upgrade)()
    table = sa.Table("reward_grants", sa.MetaData(), *cast(tuple[SchemaItem, ...], tables["reward_grants"]))
    constraints = [item for item in table.constraints if isinstance(item, sa.UniqueConstraint)]
    assert [[column.name for column in constraint.columns] for constraint in constraints] == [["user_id", "event_code"]]


def test_ai_cost_security_migration_follows_credit_wallet() -> None:
    migration = _load_migration("20260809_0015_ai_cost_security.py")
    columns = cast(Callable[[], list[sa.Column[object]]], migration._credit_usage_columns)()
    names = {column.name for column in columns}
    assert migration.down_revision == "20260809_0014"
    assert {"provider_attempts", "input_tokens", "output_tokens", "thought_tokens", "total_tokens", "usage_metadata_complete", "reserved_cost_usd", "provider_cost_usd", "response_body"} == names


def test_credit_integrity_migration_follows_ai_cost_security() -> None:
    migration = _load_migration("20260809_0016_credit_integrity.py")
    constraints = cast(tuple[tuple[str, str, str], ...], migration.CONSTRAINTS)
    names = {name for _, name, _ in constraints}
    assert migration.down_revision == "20260809_0015"
    assert {"ck_credit_usages_status", "ck_credit_usages_source_total", "ck_credit_usages_provider_costs"} <= names


def test_auto_post_cost_guard_follows_credit_integrity() -> None:
    migration = _load_migration("20260809_0017_auto_post_cost_guard.py")
    assert migration.down_revision == "20260809_0016"


def test_character_visibility_migration_follows_auto_post_cost_guard(monkeypatch: pytest.MonkeyPatch) -> None:
    migration = _load_migration("20260810_0017_character_visibility.py")
    columns: list[tuple[str, sa.Column[object]]] = []
    monkeypatch.setattr(migration.op, "add_column", lambda table, column: columns.append((table, column)))
    cast(Callable[[], None], migration.upgrade)()
    assert migration.revision == "20260810_0018"
    assert migration.down_revision == "20260809_0017"
    assert [(table, column.name, str(column.server_default.arg)) for table, column in columns] == [("characters", "is_public", "true")]


def test_feed_pagination_migration_installs_incremental_projection(monkeypatch: pytest.MonkeyPatch) -> None:
    migration = _load_migration("20260810_0019_feed_pagination.py")
    indexes: list[str] = []
    statements: list[str] = []
    monkeypatch.setattr(migration.op, "create_table", lambda *args, **kwargs: None)
    monkeypatch.setattr(migration.op, "create_index", lambda name, *args, **kwargs: indexes.append(name))
    monkeypatch.setattr(migration.op, "execute", lambda statement: statements.append(str(statement)))
    cast(Callable[[], None], migration.upgrade)()
    assert migration.down_revision == "20260810_0018"
    assert {"ix_public_feed_posts_cursor", "ix_shared_characters_tags_gin"} <= set(indexes)
    rendered = "\n".join(statements)
    assert "IS DISTINCT FROM" in rendered
    assert "public_feed_post_time" in rendered
    assert "INSERT INTO public_feed_posts" in rendered


def test_feed_limit_migration_follows_feed_pagination() -> None:
    migration = _load_migration("20260810_0020_feed_limits_and_concurrent_tags_index.py")
    assert migration.down_revision == "20260810_0019"


def test_iap_subject_retention_migration_follows_subject_history(monkeypatch: pytest.MonkeyPatch) -> None:
    migration = _load_migration("20260811_0023_iap_purchase_retention.py")
    statements: list[str] = []
    monkeypatch.setattr(migration.op, "add_column", lambda *args, **kwargs: None)
    monkeypatch.setattr(migration.op, "alter_column", lambda *args, **kwargs: None)
    monkeypatch.setattr(migration.op, "create_index", lambda *args, **kwargs: None)
    monkeypatch.setattr(migration.op, "execute", lambda statement: statements.append(str(statement)))
    cast(Callable[[], None], migration.upgrade)()
    assert migration.down_revision == "20260811_0022"
    assert "INTERVAL '5 years'" in statements[0]
