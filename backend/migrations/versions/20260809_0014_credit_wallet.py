"""Add credit, energy, reward, ledger, and AI usage tables."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Optional, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260809_0014"
down_revision: Optional[str] = "20260809_0013"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    uuid = postgresql.UUID(as_uuid=True)
    op.create_table("credit_accounts", sa.Column("user_id", uuid, sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True), sa.Column("purchased_credits", sa.Integer(), nullable=False, server_default="0"), sa.Column("bonus_credits", sa.Integer(), nullable=False, server_default="0"), sa.Column("version", sa.Integer(), nullable=False, server_default="0"), *_timestamps(), sa.CheckConstraint("purchased_credits >= 0", name="ck_credit_accounts_purchased_nonnegative"), sa.CheckConstraint("bonus_credits >= 0", name="ck_credit_accounts_bonus_nonnegative"), sa.CheckConstraint("version >= 0", name="ck_credit_accounts_version_nonnegative"))
    op.create_table("energy_accounts", sa.Column("user_id", uuid, sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True), sa.Column("energy_percent", sa.Integer(), nullable=False, server_default="100"), sa.Column("last_recovered_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")), *_timestamps(), sa.CheckConstraint("energy_percent BETWEEN 0 AND 100", name="ck_energy_accounts_percent"))
    op.create_table("credit_ledger_entries", sa.Column("id", uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")), sa.Column("user_id", uuid, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("entry_type", sa.String(32), nullable=False), sa.Column("balance_type", sa.String(16), nullable=False), sa.Column("amount", sa.Integer(), nullable=False), sa.Column("idempotency_key", sa.String(180), nullable=False), sa.Column("metadata", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")), sa.UniqueConstraint("user_id", "idempotency_key", name="uq_credit_ledger_user_idempotency"))
    op.create_index("ix_credit_ledger_user_created", "credit_ledger_entries", ["user_id", "created_at"])
    op.create_table("reward_grants", sa.Column("id", uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")), sa.Column("user_id", uuid, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("event_code", sa.String(64), nullable=False), sa.Column("credits", sa.Integer(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")), sa.UniqueConstraint("user_id", "event_code", name="uq_reward_grants_user_event"))
    op.create_table("credit_usages", sa.Column("id", uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")), sa.Column("user_id", uuid, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("flow", sa.String(64), nullable=False), sa.Column("policy_version", sa.String(64), nullable=False), sa.Column("model", sa.String(64), nullable=False, server_default=""), sa.Column("status", sa.String(16), nullable=False, server_default="reserved"), sa.Column("credits", sa.Integer(), nullable=False, server_default="0"), sa.Column("energy_percent", sa.Integer(), nullable=False, server_default="0"), sa.Column("bonus_credits", sa.Integer(), nullable=False, server_default="0"), sa.Column("purchased_credits", sa.Integer(), nullable=False, server_default="0"), sa.Column("idempotency_key", sa.String(180), nullable=False), sa.Column("provider_status", sa.String(32), nullable=False, server_default=""), *_timestamps(), sa.UniqueConstraint("user_id", "idempotency_key", name="uq_credit_usages_user_idempotency"), sa.CheckConstraint("credits >= 0", name="ck_credit_usages_credits_nonnegative"), sa.CheckConstraint("energy_percent >= 0", name="ck_credit_usages_energy_nonnegative"))
    op.create_index("ix_credit_usages_user_created", "credit_usages", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_credit_usages_user_created", table_name="credit_usages")
    op.drop_table("credit_usages")
    op.drop_table("reward_grants")
    op.drop_index("ix_credit_ledger_user_created", table_name="credit_ledger_entries")
    op.drop_table("credit_ledger_entries")
    op.drop_table("energy_accounts")
    op.drop_table("credit_accounts")


def _timestamps() -> list[sa.Column[object]]:
    return [sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False)]
