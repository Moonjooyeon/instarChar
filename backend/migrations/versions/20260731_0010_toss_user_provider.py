"""Add the Apps in Toss user provider.

Revision ID: 20260731_0010
Revises: 20260730_0009
Create Date: 2026-07-31
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Optional, Union

from alembic import op


revision: str = "20260731_0010"
down_revision: Optional[str] = "20260730_0009"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    op.execute("ALTER TYPE user_provider ADD VALUE IF NOT EXISTS 'toss'")


def downgrade() -> None:
    pass
