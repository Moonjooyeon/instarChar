"""Index native OAuth codes for bounded retention cleanup."""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op


revision: str = "20260826_0034"
down_revision: str | Sequence[str] | None = "20260825_0033"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index("ix_native_oauth_codes_expires_at", "native_oauth_codes", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_native_oauth_codes_expires_at", table_name="native_oauth_codes")
