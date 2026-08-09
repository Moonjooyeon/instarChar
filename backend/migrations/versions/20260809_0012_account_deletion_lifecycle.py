"""Add account deletion lifecycle state and identity retention.

Revision ID: 20260809_0012
Revises: 20260806_0011
Create Date: 2026-08-09
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Optional, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260809_0012"
down_revision: Optional[str] = "20260806_0011"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    op.execute("CREATE TYPE user_account_status AS ENUM ('active', 'pending_deletion')")
    op.add_column("users", sa.Column("account_status", postgresql.ENUM(name="user_account_status", create_type=False), nullable=False, server_default="active"))
    op.add_column("users", sa.Column("deletion_requested_at", sa.DateTime(timezone=True)))
    op.add_column("users", sa.Column("purge_at", sa.DateTime(timezone=True)))
    op.create_table(
        "account_deletion_identities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("provider", postgresql.ENUM(name="user_provider", create_type=False), nullable=False),
        sa.Column("identity_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("retention_until", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("provider", "identity_fingerprint", name="uq_account_deletion_identities_provider_fingerprint"),
    )
    op.create_index("ix_account_deletion_identities_retention", "account_deletion_identities", ["retention_until"])


def downgrade() -> None:
    op.drop_index("ix_account_deletion_identities_retention", table_name="account_deletion_identities")
    op.drop_table("account_deletion_identities")
    op.drop_column("users", "purge_at")
    op.drop_column("users", "deletion_requested_at")
    op.drop_column("users", "account_status")
    op.execute("DROP TYPE user_account_status")
