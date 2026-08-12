"""Record the prompt policy used for each AI credit usage."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Optional, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260812_0024"
down_revision: Optional[str] = "20260811_0023"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    column = sa.Column("prompt_version", sa.String(length=64), nullable=False, server_default="legacy")
    op.add_column("credit_usages", column)


def downgrade() -> None:
    op.drop_column("credit_usages", "prompt_version")
