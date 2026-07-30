"""Make character handles globally unique.

Revision ID: 20260730_0009
Revises: 20260728_0008
Create Date: 2026-07-30
"""

from __future__ import annotations

from collections.abc import Sequence
import re
from typing import Optional, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260730_0009"
down_revision: Optional[str] = "20260728_0008"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None

_MAX_LENGTH = 24
_RESERVED = frozenset({"admin", "administrator", "alive", "help", "mod", "moderator", "official", "staff", "support", "system"})
_INVALID = re.compile(r"[^a-z0-9._-]")


def upgrade() -> None:
    connection = op.get_bind()
    assignments = _assign_handles(_character_rows(connection))
    for character_id, owner_id, source_account_id, handle in assignments:
        _update_character(connection, character_id, handle)
        _update_snapshots(connection, owner_id, source_account_id, handle)
    op.alter_column("characters", "handle", existing_type=sa.String(120), type_=sa.String(24), server_default=None, nullable=False)
    _create_constraints()


def downgrade() -> None:
    op.drop_constraint("ck_characters_handle_reserved", "characters", type_="check")
    op.drop_constraint("ck_characters_handle_format", "characters", type_="check")
    op.drop_constraint("uq_characters_handle", "characters", type_="unique")
    op.alter_column("characters", "handle", existing_type=sa.String(24), type_=sa.String(120), server_default="", nullable=False)


def _normalize(value: str) -> str:
    normalized = value.strip().lower().lstrip("@")
    normalized = _INVALID.sub("", normalized).strip("._-")[:_MAX_LENGTH]
    return normalized.rstrip("._-")


def _next_available(value: str, used: set[str]) -> str:
    base = _normalize(value) or "character"
    if base not in used and base not in _RESERVED:
        return base
    suffix = 2
    while True:
        tail = f"-{suffix}"
        candidate = f"{base[:_MAX_LENGTH - len(tail)].rstrip('._-')}{tail}"
        if candidate not in used and candidate not in _RESERVED:
            return candidate
        suffix += 1


def _assign_handles(rows: Sequence[tuple[object, object, str, str]]) -> list[tuple[object, object, str, str]]:
    assignments: list[tuple[object, object, str, str]] = []
    used: set[str] = set()
    for character_id, owner_id, source_account_id, old_handle in rows:
        handle = _next_available(old_handle, used)
        used.add(handle)
        assignments.append((character_id, owner_id, source_account_id, handle))
    return assignments


def _character_rows(connection: sa.Connection) -> list[tuple[object, object, str, str]]:
    result = connection.execute(sa.text("SELECT id, owner_id, source_account_id, handle FROM characters ORDER BY created_at, id"))
    return [(row.id, row.owner_id, row.source_account_id, row.handle or "") for row in result]


def _update_character(connection: sa.Connection, character_id: object, handle: str) -> None:
    statement = sa.text("UPDATE characters SET handle = :handle, character = jsonb_set(COALESCE(character, '{}'::jsonb), '{handle}', to_jsonb(CAST(:handle AS text)), true) WHERE id = :character_id")
    connection.execute(statement, {"character_id": character_id, "handle": handle})


def _update_snapshots(connection: sa.Connection, owner_id: object, source_account_id: str, handle: str) -> None:
    parameters = {"owner_id": owner_id, "source_account_id": source_account_id, "handle": handle}
    shared = "UPDATE shared_characters SET handle = :handle, character = jsonb_set(COALESCE(character, '{}'::jsonb), '{handle}', to_jsonb(CAST(:handle AS text)), true) WHERE owner_id = :owner_id AND source_account_id = :source_account_id"
    follower = "UPDATE character_follows SET follower_character = jsonb_set(COALESCE(follower_character, '{}'::jsonb), '{handle}', to_jsonb(CAST(:handle AS text)), true) WHERE follower_id = :owner_id AND follower_account_id = :source_account_id"
    connection.execute(sa.text(shared), parameters)
    connection.execute(sa.text(follower), parameters)


def _create_constraints() -> None:
    op.create_unique_constraint("uq_characters_handle", "characters", ["handle"])
    op.create_check_constraint("ck_characters_handle_format", "characters", "handle ~ '^[a-z0-9]([a-z0-9._-]{0,22}[a-z0-9])?$'")
    reserved = ", ".join(f"'{value}'" for value in sorted(_RESERVED))
    op.create_check_constraint("ck_characters_handle_reserved", "characters", f"handle NOT IN ({reserved})")
