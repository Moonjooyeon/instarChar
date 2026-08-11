"""Add credit ledger and usage integrity constraints."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Optional, Union

from alembic import op


revision: str = "20260809_0016"
down_revision: Optional[str] = "20260809_0015"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


CONSTRAINTS = (
    ("credit_ledger_entries", "ck_credit_ledger_entry_type", "entry_type IN ('grant', 'debit', 'refund', 'purchase', 'adjustment', 'chargeback')"),
    ("credit_ledger_entries", "ck_credit_ledger_balance_type", "balance_type IN ('bonus', 'purchased')"),
    ("credit_ledger_entries", "ck_credit_ledger_amount_nonzero", "amount <> 0"),
    ("reward_grants", "ck_reward_grants_credits_positive", "credits > 0"),
    ("credit_usages", "ck_credit_usages_status", "status IN ('reserved', 'committed', 'refunded')"),
    ("credit_usages", "ck_credit_usages_bonus_nonnegative", "bonus_credits >= 0"),
    ("credit_usages", "ck_credit_usages_purchased_nonnegative", "purchased_credits >= 0"),
    ("credit_usages", "ck_credit_usages_source_total", "credits = bonus_credits + purchased_credits"),
    ("credit_usages", "ck_credit_usages_single_payment_kind", "energy_percent = 0 OR credits = 0"),
    ("credit_usages", "ck_credit_usages_provider_counts", "provider_attempts >= 0 AND input_tokens >= 0 AND output_tokens >= 0 AND thought_tokens >= 0 AND total_tokens >= 0"),
    ("credit_usages", "ck_credit_usages_provider_costs", "reserved_cost_usd >= 0 AND provider_cost_usd >= 0"),
)


def upgrade() -> None:
    for table, name, condition in CONSTRAINTS:
        op.create_check_constraint(name, table, condition)


def downgrade() -> None:
    for table, name, _ in reversed(CONSTRAINTS):
        op.drop_constraint(name, table, type_="check")
