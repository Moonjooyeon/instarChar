"""Process Apple account server notifications.

Revision ID: 20260728_0008
Revises: 20260728_0007
Create Date: 2026-07-28
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Optional, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260728_0008"
down_revision: Optional[str] = "20260728_0007"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("auth_revoked_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("apple_oauth_credentials", sa.Column("email_forwarding_enabled", sa.Boolean(), nullable=True))
    op.create_table("apple_account_events", *_event_columns())


def downgrade() -> None:
    op.drop_table("apple_account_events")
    op.drop_column("apple_oauth_credentials", "email_forwarding_enabled")
    op.drop_column("users", "auth_revoked_at")


def _event_columns() -> list[sa.Column | sa.UniqueConstraint]:
    return [
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_id", sa.String(length=255), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("payload_hash", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), server_default="pending", nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("event_id", name="uq_apple_account_events_event_id"),
    ]
