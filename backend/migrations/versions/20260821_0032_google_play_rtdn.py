"""Add Google Play account mapping and RTDN event records."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260821_0032"
down_revision: str | Sequence[str] | None = "20260821_0031"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table("google_play_accounts", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True), sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("account_id", sa.String(length=64), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.UniqueConstraint("account_id", name="uq_google_play_accounts_account_id"))
    op.create_table("google_play_rtdn_events", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True), sa.Column("message_id", sa.String(length=255), nullable=False), sa.Column("notification_type", sa.String(length=64), nullable=False), sa.Column("purchase_token", sa.String(length=512), nullable=False, server_default=""), sa.Column("status", sa.String(length=32), nullable=False, server_default="processing"), sa.Column("failure_reason", sa.String(length=255), nullable=False, server_default=""), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("claimed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True), sa.UniqueConstraint("message_id", name="uq_google_play_rtdn_events_message_id"))
    op.create_index("ix_google_play_rtdn_events_status_created", "google_play_rtdn_events", ["status", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_google_play_rtdn_events_status_created", table_name="google_play_rtdn_events")
    op.drop_table("google_play_rtdn_events")
    op.drop_table("google_play_accounts")
