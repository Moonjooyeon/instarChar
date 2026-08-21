"""Add a durable claim lease for autonomous posts."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260820_0030"
down_revision: str = "20260815_0029"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("characters", sa.Column("auto_post_claimed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("characters", sa.Column("auto_post_legacy_credit_stop_recovered", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.execute(sa.text("""
        UPDATE characters
        SET auto_post_enabled = true,
            next_auto_post_at = CURRENT_TIMESTAMP + (auto_post_interval_seconds * INTERVAL '1 second'),
            auto_post_claimed_at = NULL,
            auto_post_legacy_credit_stop_recovered = true,
            last_auto_post_error = '',
            auto_post_failure_count = 0
        WHERE auto_post_enabled IS false
          AND last_auto_post_error = 'AUTO_POST_CREDIT_INSUFFICIENT'
    """))


def downgrade() -> None:
    op.execute(sa.text("""
        UPDATE characters
        SET auto_post_enabled = false,
            next_auto_post_at = NULL,
            auto_post_claimed_at = NULL,
            last_auto_post_error = 'AUTO_POST_CREDIT_INSUFFICIENT',
            auto_post_failure_count = 0
        WHERE auto_post_legacy_credit_stop_recovered IS true
    """))
    op.drop_column("characters", "auto_post_legacy_credit_stop_recovered")
    op.drop_column("characters", "auto_post_claimed_at")
