"""Set six-hour automatic posting defaults for new characters."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Optional, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260815_0029"
down_revision: Optional[str] = "20260814_0028"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    op.alter_column("characters", "auto_post_interval_seconds", existing_type=sa.Integer(), server_default="21600")
    op.alter_column("characters", "next_auto_post_at", existing_type=sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP + INTERVAL '6 hours')"))


def downgrade() -> None:
    op.alter_column("characters", "next_auto_post_at", existing_type=sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP + INTERVAL '1 hour')"))
    op.alter_column("characters", "auto_post_interval_seconds", existing_type=sa.Integer(), server_default="3600")
