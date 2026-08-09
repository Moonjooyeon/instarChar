"""Add AI cost accounting and idempotent response fields."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Optional, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260809_0015"
down_revision: Optional[str] = "20260809_0014"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    op.add_column("ai_daily_usage", _money_column("actual_cost_usd"))
    op.add_column("ai_monthly_usage", _money_column("actual_cost_usd"))
    for column in _credit_usage_columns():
        op.add_column("credit_usages", column)


def downgrade() -> None:
    for column in reversed(_credit_usage_columns()):
        op.drop_column("credit_usages", column.name)
    op.drop_column("ai_monthly_usage", "actual_cost_usd")
    op.drop_column("ai_daily_usage", "actual_cost_usd")


def _credit_usage_columns() -> list[sa.Column[object]]:
    integers = [sa.Column(name, sa.Integer(), nullable=False, server_default="0") for name in ("provider_attempts", "input_tokens", "output_tokens", "thought_tokens", "total_tokens")]
    metadata = sa.Column("usage_metadata_complete", sa.Boolean(), nullable=False, server_default=sa.false())
    costs = [_money_column("reserved_cost_usd"), _money_column("provider_cost_usd")]
    response = sa.Column("response_body", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb"))
    return integers + [metadata] + costs + [response]


def _money_column(name: str) -> sa.Column[object]:
    return sa.Column(name, sa.Numeric(14, 8), nullable=False, server_default="0")
