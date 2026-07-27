"""Add UGC safety, consent, reporting, and blocking.

Revision ID: 20260724_0006
Revises: 20260724_0005
Create Date: 2026-07-24
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Optional, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260724_0006"
down_revision: Optional[str] = "20260724_0005"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    _create_enums()
    _alter_users()
    _create_consents()
    _create_blocks()
    _create_reports()


def downgrade() -> None:
    op.drop_table("content_reports")
    op.drop_table("user_blocks")
    op.drop_table("user_policy_consents")
    op.drop_column("users", "moderation_status")
    op.execute("DROP TYPE report_status")
    op.execute("DROP TYPE user_moderation_status")


def _create_enums() -> None:
    op.execute("CREATE TYPE user_moderation_status AS ENUM ('active', 'suspended', 'banned')")
    op.execute("CREATE TYPE report_status AS ENUM ('pending', 'reviewing', 'resolved', 'dismissed')")


def _alter_users() -> None:
    moderation_status = postgresql.ENUM("active", "suspended", "banned", name="user_moderation_status", create_type=False)
    op.add_column("users", sa.Column("moderation_status", moderation_status, server_default="active", nullable=False))


def _create_consents() -> None:
    op.create_table(
        "user_policy_consents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("terms_version", sa.String(length=32), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "terms_version", name="uq_user_policy_consents_version"),
    )


def _create_blocks() -> None:
    op.create_table(
        "user_blocks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("blocker_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("blocked_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["blocker_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["blocked_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("blocker_id", "blocked_id", name="uq_user_blocks_pair"),
    )


def _create_reports() -> None:
    report_status = postgresql.ENUM("pending", "reviewing", "resolved", "dismissed", name="report_status", create_type=False)
    op.create_table("content_reports", *_report_columns(report_status))
    op.create_index("ix_content_reports_status_created", "content_reports", ["status", "created_at"])


def _report_columns(report_status: postgresql.ENUM) -> list[sa.Column | sa.ForeignKeyConstraint]:
    return [
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("reporter_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_type", sa.String(length=32), nullable=False),
        sa.Column("target_owner_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("target_reference", sa.String(length=500), nullable=False),
        sa.Column("reason", sa.String(length=32), nullable=False),
        sa.Column("detail", sa.Text(), server_default="", nullable=False),
        sa.Column("snapshot", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("status", report_status, server_default="pending", nullable=False),
        sa.Column("resolution_action", sa.String(length=32), server_default="none", nullable=False),
        sa.Column("moderator_note", sa.Text(), server_default="", nullable=False),
        sa.Column("resolved_by", sa.String(length=120), server_default="", nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["reporter_id"], ["users.id"], ondelete="CASCADE"),
    ]
