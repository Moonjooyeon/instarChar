"""Align purchase timestamps with the ORM contract."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Optional, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260812_0025"
down_revision: Optional[str] = "20260812_0024"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    op.execute(sa.text("UPDATE credit_purchases SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP), updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP) WHERE created_at IS NULL OR updated_at IS NULL"))
    _set_timestamp_nullable(False)


def downgrade() -> None:
    _set_timestamp_nullable(True)


def _set_timestamp_nullable(nullable: bool) -> None:
    for column in ("created_at", "updated_at"):
        op.alter_column("credit_purchases", column, existing_type=sa.DateTime(timezone=True), nullable=nullable)
