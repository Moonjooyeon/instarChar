"""Add Apps in Toss credit purchases and refund debt."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Optional, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260811_0021"
down_revision: Optional[str] = "20260810_0020"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    op.add_column("credit_accounts", sa.Column("debt_credits", sa.Integer(), nullable=False, server_default="0"))
    op.create_check_constraint("ck_credit_accounts_debt_nonnegative", "credit_accounts", "debt_credits >= 0")
    op.create_table("credit_purchases", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True), sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True), sa.Column("provider", sa.String(32), nullable=False, server_default="apps_in_toss"), sa.Column("provider_order_id", sa.String(80), nullable=False), sa.Column("provider_subject_hash", sa.String(64), nullable=False), sa.Column("sku", sa.String(255), nullable=False), sa.Column("status", sa.String(32), nullable=False, server_default="processing"), sa.Column("provider_status", sa.String(32), nullable=False, server_default=""), sa.Column("price_krw", sa.Integer(), nullable=False, server_default="0"), sa.Column("base_credits", sa.Integer(), nullable=False, server_default="0"), sa.Column("product_bonus_credits", sa.Integer(), nullable=False, server_default="0"), sa.Column("first_purchase_bonus_credits", sa.Integer(), nullable=False, server_default="0"), sa.Column("granted_credits", sa.Integer(), nullable=False, server_default="0"), sa.Column("chargeback_credits", sa.Integer(), nullable=False, server_default="0"), sa.Column("failure_reason", sa.String(255), nullable=False, server_default=""), sa.Column("provider_checked_at", sa.DateTime(timezone=True)), sa.Column("granted_at", sa.DateTime(timezone=True)), sa.Column("refunded_at", sa.DateTime(timezone=True)), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()), sa.UniqueConstraint("provider_order_id", name="uq_credit_purchases_provider_order"), sa.CheckConstraint("status IN ('processing', 'granted', 'refunded', 'failed', 'review')", name="ck_credit_purchases_status"), sa.CheckConstraint("base_credits >= 0 AND product_bonus_credits >= 0 AND first_purchase_bonus_credits >= 0 AND granted_credits >= 0 AND chargeback_credits >= 0", name="ck_credit_purchases_credit_amounts"))
    op.create_index("ix_credit_purchases_user_created", "credit_purchases", ["user_id", "created_at"])
    op.create_index("ix_credit_purchases_status_checked", "credit_purchases", ["status", "provider_checked_at"])


def downgrade() -> None:
    op.drop_index("ix_credit_purchases_status_checked", table_name="credit_purchases")
    op.drop_index("ix_credit_purchases_user_created", table_name="credit_purchases")
    op.drop_table("credit_purchases")
    op.drop_constraint("ck_credit_accounts_debt_nonnegative", "credit_accounts", type_="check")
    op.drop_column("credit_accounts", "debt_credits")
