"""Add indexes for recent recommendation signals."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Optional, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260813_0026"
down_revision: Optional[str] = "20260812_0025"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None

INDEXES: tuple[tuple[str, str, tuple[str, ...]], ...] = (
    ("ix_character_follows_follower_recent", "character_follows", ("follower_id", "follower_account_id", "created_at", "id", "target_shared_character_id")),
    ("ix_character_post_likes_liker_recent", "character_post_likes", ("liker_owner_id", "liker_account_id", "created_at", "id", "target_character_id")),
    ("ix_user_blocks_blocked_blocker", "user_blocks", ("blocked_id", "blocker_id")),
)
_LOCK_KEY = 202608130026
_INDEX_VALIDITY = sa.text("""
SELECT ix.indisvalid
FROM pg_catalog.pg_index AS ix
JOIN pg_catalog.pg_class AS relation ON relation.oid = ix.indexrelid
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
WHERE namespace.nspname = current_schema() AND relation.relname = :name
""")


def upgrade() -> None:
    with op.get_context().autocommit_block():
        _lock()
        try:
            for name, table, columns in INDEXES:
                _ensure_index(name, table, columns)
        finally:
            _unlock()


def downgrade() -> None:
    with op.get_context().autocommit_block():
        _lock()
        try:
            for name, _, _ in reversed(INDEXES):
                _drop_index(name)
        finally:
            _unlock()


def _ensure_index(name: str, table: str, columns: tuple[str, ...]) -> None:
    if op.get_context().as_sql:
        _create_index(name, table, columns)
        return
    validity = _index_validity(name)
    if validity is True:
        return
    if validity is False:
        _drop_index(name)
    _create_index(name, table, columns)


def _index_validity(name: str) -> bool | None:
    value = op.get_bind().execute(_INDEX_VALIDITY, {"name": name}).scalar_one_or_none()
    return bool(value) if value is not None else None


def _create_index(name: str, table: str, columns: tuple[str, ...]) -> None:
    op.create_index(name, table, list(columns), if_not_exists=True, postgresql_concurrently=True)


def _drop_index(name: str) -> None:
    op.execute(sa.text(f'DROP INDEX CONCURRENTLY IF EXISTS "{name}"'))


def _lock() -> None:
    op.execute(sa.text(f"SELECT pg_advisory_lock({_LOCK_KEY})"))


def _unlock() -> None:
    op.execute(sa.text(f"SELECT pg_advisory_unlock({_LOCK_KEY})"))
