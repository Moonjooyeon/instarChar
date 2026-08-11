"""Index stable Toss IAP subject purchase history."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Optional, Union

from alembic import op


revision: str = "20260811_0022"
down_revision: Optional[str] = "20260811_0021"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    op.create_index("ix_credit_purchases_subject_granted", "credit_purchases", ["provider_subject_hash", "granted_credits"])


def downgrade() -> None:
    op.drop_index("ix_credit_purchases_subject_granted", table_name="credit_purchases")
