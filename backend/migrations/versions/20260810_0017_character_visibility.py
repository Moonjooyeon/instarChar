"""Add server-owned character visibility."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Optional, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260810_0018"
down_revision: Optional[str] = "20260809_0017"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    op.add_column("characters", sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.true()))


def downgrade() -> None:
    op.drop_column("characters", "is_public")
