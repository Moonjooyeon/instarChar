"""Merge recommendation indexes and auto-post defaults."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Optional, Union


revision: str = "20260814_0028"
down_revision: Optional[Union[str, Sequence[str]]] = ("20260813_0026", "20260814_0027")
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
