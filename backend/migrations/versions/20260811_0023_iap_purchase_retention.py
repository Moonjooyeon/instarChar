"""Expire retained Apps in Toss purchases after account deletion."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Optional, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260811_0023"
down_revision: Optional[str] = "20260811_0022"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    op.add_column("credit_purchases", sa.Column("retention_until", sa.DateTime(timezone=True), nullable=True))
    op.execute(sa.text("UPDATE credit_purchases SET retention_until = GREATEST(created_at + INTERVAL '5 years', CURRENT_TIMESTAMP) WHERE user_id IS NULL"))
    op.create_index("ix_credit_purchases_retention", "credit_purchases", ["retention_until"])


def downgrade() -> None:
    op.drop_index("ix_credit_purchases_retention", table_name="credit_purchases")
    op.drop_column("credit_purchases", "retention_until")
