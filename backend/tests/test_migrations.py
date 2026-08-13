from collections.abc import Callable
from contextlib import nullcontext
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from types import ModuleType
from typing import cast
from unittest.mock import Mock

import pytest
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.sql.schema import SchemaItem

from app.models.entities import Base


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


def _autocommit_context() -> Mock:
    context = Mock()
    context.as_sql = False
    context.autocommit_block.return_value = nullcontext()
    return context


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


def test_ai_prompt_version_migration_follows_iap_retention(monkeypatch: pytest.MonkeyPatch) -> None:
    migration = _load_migration("20260812_0024_ai_prompt_version.py")
    columns: list[sa.Column[object]] = []
    monkeypatch.setattr(migration.op, "add_column", lambda table, column: columns.append(column))
    cast(Callable[[], None], migration.upgrade)()
    assert migration.down_revision == "20260811_0023"
    assert [(column.name, column.nullable, str(column.server_default.arg)) for column in columns] == [("prompt_version", False, "legacy")]


def test_schema_alignment_migration_follows_ai_prompt_version(monkeypatch: pytest.MonkeyPatch) -> None:
    migration = _load_migration("20260812_0025_schema_alignment.py")
    statements: list[str] = []
    alterations: list[tuple[str, str, bool]] = []
    monkeypatch.setattr(migration.op, "execute", lambda statement: statements.append(str(statement)))
    monkeypatch.setattr(migration.op, "alter_column", lambda table, column, **values: alterations.append((table, column, values["nullable"])))
    cast(Callable[[], None], migration.upgrade)()
    assert migration.down_revision == "20260812_0024"
    assert "UPDATE credit_purchases" in statements[0]
    assert alterations == [("credit_purchases", "created_at", False), ("credit_purchases", "updated_at", False)]


def test_recommendation_signal_indexes_are_created_concurrently(monkeypatch: pytest.MonkeyPatch) -> None:
    migration = _load_migration("20260813_0026_recommendation_signal_indexes.py")
    created: list[tuple[str, str, list[str], bool, bool]] = []
    statements: list[str] = []
    connection = Mock()
    connection.execute.return_value.scalar_one_or_none.return_value = None
    monkeypatch.setattr(migration.op, "get_context", _autocommit_context)
    monkeypatch.setattr(migration.op, "get_bind", lambda: connection)
    monkeypatch.setattr(migration.op, "create_index", lambda name, table, columns, **values: created.append((name, table, columns, values["postgresql_concurrently"], values["if_not_exists"])))
    monkeypatch.setattr(migration.op, "execute", lambda statement: statements.append(str(statement)))
    cast(Callable[[], None], migration.upgrade)()
    assert migration.down_revision == "20260812_0025"
    assert created == [
        ("ix_character_follows_follower_recent", "character_follows", ["follower_id", "follower_account_id", "created_at", "id", "target_shared_character_id"], True, True),
        ("ix_character_post_likes_liker_recent", "character_post_likes", ["liker_owner_id", "liker_account_id", "created_at", "id", "target_character_id"], True, True),
        ("ix_user_blocks_blocked_blocker", "user_blocks", ["blocked_id", "blocker_id"], True, True),
    ]
    assert statements == [f"SELECT pg_advisory_lock({migration._LOCK_KEY})", f"SELECT pg_advisory_unlock({migration._LOCK_KEY})"]


def test_recommendation_signal_indexes_only_replace_invalid_artifacts(monkeypatch: pytest.MonkeyPatch) -> None:
    migration = _load_migration("20260813_0026_recommendation_signal_indexes.py")
    results = [Mock(), Mock(), Mock()]
    for result, validity in zip(results, [True, False, None], strict=True):
        result.scalar_one_or_none.return_value = validity
    connection = Mock()
    connection.execute.side_effect = results
    created: list[str] = []
    statements: list[str] = []
    monkeypatch.setattr(migration.op, "get_context", _autocommit_context)
    monkeypatch.setattr(migration.op, "get_bind", lambda: connection)
    monkeypatch.setattr(migration.op, "create_index", lambda name, *args, **kwargs: created.append(name))
    monkeypatch.setattr(migration.op, "execute", lambda statement: statements.append(str(statement)))
    cast(Callable[[], None], migration.upgrade)()
    assert created == [migration.INDEXES[1][0], migration.INDEXES[2][0]]
    assert statements[1:-1] == [f'DROP INDEX CONCURRENTLY IF EXISTS "{migration.INDEXES[1][0]}"']


def test_recommendation_signal_indexes_support_offline_sql(monkeypatch: pytest.MonkeyPatch) -> None:
    migration = _load_migration("20260813_0026_recommendation_signal_indexes.py")
    context = _autocommit_context()
    context.as_sql = True
    created: list[tuple[str, bool]] = []
    monkeypatch.setattr(migration.op, "get_context", lambda: context)
    monkeypatch.setattr(migration.op, "get_bind", Mock(side_effect=AssertionError("offline SQL must not query PostgreSQL")))
    monkeypatch.setattr(migration.op, "create_index", lambda name, *args, **values: created.append((name, values["if_not_exists"])))
    monkeypatch.setattr(migration.op, "execute", lambda statement: None)
    cast(Callable[[], None], migration.upgrade)()
    assert created == [(name, True) for name, _, _ in migration.INDEXES]


def test_recommendation_signal_index_lock_releases_after_create_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    migration = _load_migration("20260813_0026_recommendation_signal_indexes.py")
    connection = Mock()
    connection.execute.return_value.scalar_one_or_none.return_value = None
    statements: list[str] = []
    monkeypatch.setattr(migration.op, "get_context", _autocommit_context)
    monkeypatch.setattr(migration.op, "get_bind", lambda: connection)
    monkeypatch.setattr(migration.op, "create_index", Mock(side_effect=RuntimeError("create failed")))
    monkeypatch.setattr(migration.op, "execute", lambda statement: statements.append(str(statement)))
    with pytest.raises(RuntimeError, match="create failed"):
        cast(Callable[[], None], migration.upgrade)()
    assert statements == [f"SELECT pg_advisory_lock({migration._LOCK_KEY})", f"SELECT pg_advisory_unlock({migration._LOCK_KEY})"]


def test_recommendation_signal_indexes_are_dropped_concurrently(monkeypatch: pytest.MonkeyPatch) -> None:
    migration = _load_migration("20260813_0026_recommendation_signal_indexes.py")
    statements: list[str] = []
    monkeypatch.setattr(migration.op, "get_context", _autocommit_context)
    monkeypatch.setattr(migration.op, "execute", lambda statement: statements.append(str(statement)))
    cast(Callable[[], None], migration.downgrade)()
    assert statements == [
        f"SELECT pg_advisory_lock({migration._LOCK_KEY})",
        'DROP INDEX CONCURRENTLY IF EXISTS "ix_user_blocks_blocked_blocker"',
        'DROP INDEX CONCURRENTLY IF EXISTS "ix_character_post_likes_liker_recent"',
        'DROP INDEX CONCURRENTLY IF EXISTS "ix_character_follows_follower_recent"',
        f"SELECT pg_advisory_unlock({migration._LOCK_KEY})",
    ]


def test_recommendation_signal_indexes_match_model_metadata() -> None:
    migration = _load_migration("20260813_0026_recommendation_signal_indexes.py")
    indexes = cast(tuple[tuple[str, str, tuple[str, ...]], ...], migration.INDEXES)
    actual: list[tuple[str, str, tuple[str, ...]]] = []
    for name, table_name, _ in indexes:
        table = Base.metadata.tables[table_name]
        index = next(item for item in table.indexes if item.name == name)
        actual.append((name, table_name, tuple(column.name for column in index.columns)))
    assert tuple(actual) == indexes
