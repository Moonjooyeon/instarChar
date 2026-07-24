"""Add post authority, auto-post state, and PostgreSQL AI usage.

Revision ID: 20260723_0002
Revises: 20260626_0001
Create Date: 2026-07-23
"""

from collections.abc import Sequence
from typing import Optional, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260723_0002"
down_revision: Optional[str] = "20260626_0001"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    _add_character_post_state()
    _create_usage_tables()


def downgrade() -> None:
    op.drop_table("ai_monthly_usage")
    op.drop_table("ai_daily_usage")
    for column in reversed(_character_columns()):
        op.drop_column("characters", column.name)


def _add_character_post_state() -> None:
    for column in _character_columns():
        op.add_column("characters", column)


def _character_columns() -> list[sa.Column[object]]:
    return [
        sa.Column("posts_revision", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("auto_post_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("auto_post_interval_seconds", sa.Integer(), nullable=False, server_default="900"),
        sa.Column("next_auto_post_at", sa.DateTime(timezone=True)),
        sa.Column("last_auto_post_at", sa.DateTime(timezone=True)),
        sa.Column("last_auto_post_error", sa.Text(), nullable=False, server_default=""),
        sa.Column("auto_post_failure_count", sa.Integer(), nullable=False, server_default="0"),
    ]


def _create_usage_tables() -> None:
    _create_daily_usage()
    _create_monthly_usage()


def _create_daily_usage() -> None:
    op.create_table(
        "ai_daily_usage",
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("usage_date", sa.Date(), primary_key=True),
        sa.Column("call_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("estimated_cost_usd", sa.Numeric(12, 6), nullable=False, server_default="0"),
        *_timestamps(),
    )


def _create_monthly_usage() -> None:
    op.create_table(
        "ai_monthly_usage",
        sa.Column("usage_month", sa.String(7), primary_key=True),
        sa.Column("call_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("estimated_cost_usd", sa.Numeric(12, 6), nullable=False, server_default="0"),
        *_timestamps(),
    )


def _timestamps() -> list[sa.Column[object]]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    ]
