"""Enable auto-post defaults for newly created characters."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Optional, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260814_0026"
down_revision: Optional[str] = "20260812_0025"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    op.execute(sa.text("UPDATE characters SET auto_post_interval_seconds = 21600, next_auto_post_at = CASE WHEN auto_post_enabled IS TRUE AND (next_auto_post_at IS NULL OR next_auto_post_at > CURRENT_TIMESTAMP + INTERVAL '6 hours') THEN CURRENT_TIMESTAMP + INTERVAL '6 hours' ELSE next_auto_post_at END WHERE auto_post_interval_seconds = 43200"))
    op.alter_column("characters", "auto_post_enabled", existing_type=sa.Boolean(), server_default=sa.true())
    op.alter_column("characters", "auto_post_interval_seconds", existing_type=sa.Integer(), server_default="21600")
    op.alter_column("characters", "next_auto_post_at", existing_type=sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP + INTERVAL '6 hours')"))


def downgrade() -> None:
    op.alter_column("characters", "next_auto_post_at", existing_type=sa.DateTime(timezone=True), server_default=None)
    op.alter_column("characters", "auto_post_interval_seconds", existing_type=sa.Integer(), server_default="3600")
    op.alter_column("characters", "auto_post_enabled", existing_type=sa.Boolean(), server_default=sa.false())
