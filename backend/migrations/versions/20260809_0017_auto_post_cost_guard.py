"""Increase the minimum auto-post interval for AI cost safety."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Optional, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260809_0017"
down_revision: Optional[str] = "20260809_0016"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    op.execute(sa.text("UPDATE characters SET auto_post_interval_seconds = 3600 WHERE auto_post_interval_seconds < 3600"))
    op.alter_column("characters", "auto_post_interval_seconds", server_default="3600")


def downgrade() -> None:
    op.alter_column("characters", "auto_post_interval_seconds", server_default="900")
