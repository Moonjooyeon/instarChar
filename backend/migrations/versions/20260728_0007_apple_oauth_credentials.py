"""Store encrypted Apple OAuth credentials.

Revision ID: 20260728_0007
Revises: 20260724_0006
Create Date: 2026-07-28
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Optional, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260728_0007"
down_revision: Optional[str] = "20260724_0006"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    op.create_table("apple_oauth_credentials", *_credential_columns())
    op.create_index("ix_apple_oauth_credentials_subject_client", "apple_oauth_credentials", ["subject", "client_id"])


def downgrade() -> None:
    op.drop_index("ix_apple_oauth_credentials_subject_client", table_name="apple_oauth_credentials")
    op.drop_table("apple_oauth_credentials")


def _credential_columns() -> list[sa.Column | sa.ForeignKeyConstraint | sa.UniqueConstraint]:
    return [
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_id", sa.String(length=255), nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("refresh_token_encrypted", sa.Text(), nullable=False),
        sa.Column("access_token_encrypted", sa.Text(), nullable=True),
        sa.Column("access_token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_validated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "client_id", name="uq_apple_oauth_credentials_user_client"),
    ]
