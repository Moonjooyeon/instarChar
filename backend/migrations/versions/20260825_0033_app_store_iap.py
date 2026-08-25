"""Add App Store IAP accounts, notifications, and payment audit fields."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260825_0033"
down_revision: str | Sequence[str] | None = "20260821_0032"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("credit_purchases", sa.Column("provider_currency", sa.String(length=3), nullable=False, server_default=""))
    op.add_column("credit_purchases", sa.Column("provider_storefront", sa.String(length=3), nullable=False, server_default=""))
    op.add_column("credit_purchases", sa.Column("provider_price_milliunits", sa.Integer(), nullable=False, server_default="0"))
    op.create_table("app_store_accounts", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True), sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("account_token", postgresql.UUID(as_uuid=True), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.UniqueConstraint("user_id", name="uq_app_store_accounts_user_id"), sa.UniqueConstraint("account_token", name="uq_app_store_accounts_account_token"))
    op.create_table("app_store_notification_events", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True), sa.Column("notification_uuid", sa.String(length=255), nullable=False), sa.Column("notification_type", sa.String(length=64), nullable=False), sa.Column("transaction_id", sa.String(length=512), nullable=False, server_default=""), sa.Column("status", sa.String(length=32), nullable=False, server_default="processing"), sa.Column("failure_reason", sa.String(length=255), nullable=False, server_default=""), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("claimed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True), sa.UniqueConstraint("notification_uuid", name="uq_app_store_notification_events_notification_uuid"))
    op.create_index("ix_app_store_notification_events_status_created", "app_store_notification_events", ["status", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_app_store_notification_events_status_created", table_name="app_store_notification_events")
    op.drop_table("app_store_notification_events")
    op.drop_table("app_store_accounts")
    op.drop_column("credit_purchases", "provider_price_milliunits")
    op.drop_column("credit_purchases", "provider_storefront")
    op.drop_column("credit_purchases", "provider_currency")
