"""Add Google Play purchase identity and consumption state."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260821_0031"
down_revision: str | Sequence[str] | None = "20260820_0030"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("uq_credit_purchases_provider_order", "credit_purchases", type_="unique")
    op.alter_column("credit_purchases", "provider_order_id", existing_type=sa.String(length=80), type_=sa.String(length=512), existing_nullable=False)
    op.create_unique_constraint("uq_credit_purchases_provider_order", "credit_purchases", ["provider", "provider_order_id"])
    op.add_column("credit_purchases", sa.Column("ledger_reference", sa.String(length=96), nullable=False, server_default=""))
    op.add_column("credit_purchases", sa.Column("provider_consumed_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("credit_purchases", "provider_consumed_at")
    op.drop_column("credit_purchases", "ledger_reference")
    op.drop_constraint("uq_credit_purchases_provider_order", "credit_purchases", type_="unique")
    op.alter_column("credit_purchases", "provider_order_id", existing_type=sa.String(length=512), type_=sa.String(length=80), existing_nullable=False)
    op.create_unique_constraint("uq_credit_purchases_provider_order", "credit_purchases", ["provider_order_id"])
