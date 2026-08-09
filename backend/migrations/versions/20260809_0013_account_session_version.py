"""Add account session generation for revocation."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Optional, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260809_0013"
down_revision: Optional[str] = "20260809_0012"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("session_version", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("users", "session_version")
