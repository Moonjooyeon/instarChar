"""Add media asset storage records.

Revision ID: 20260806_0011
Revises: 20260731_0010
Create Date: 2026-08-06
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Optional, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260806_0011"
down_revision: Optional[str] = "20260731_0010"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    _create_enums()
    _create_media_assets()


def downgrade() -> None:
    op.drop_table("media_assets")
    op.execute("DROP TYPE media_status")
    op.execute("DROP TYPE media_visibility")
    op.execute("DROP TYPE media_purpose")


def _create_enums() -> None:
    op.execute("CREATE TYPE media_purpose AS ENUM ('profile_avatar', 'profile_header', 'gallery', 'feed_post', 'dm_attachment')")
    op.execute("CREATE TYPE media_visibility AS ENUM ('public', 'private')")
    op.execute("CREATE TYPE media_status AS ENUM ('pending', 'ready', 'rejected', 'deleted')")


def _create_media_assets() -> None:
    op.create_table(
        "media_assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_account_id", sa.String(length=120)),
        sa.Column("purpose", postgresql.ENUM(name="media_purpose", create_type=False), nullable=False),
        sa.Column("visibility", postgresql.ENUM(name="media_visibility", create_type=False), nullable=False),
        sa.Column("status", postgresql.ENUM(name="media_status", create_type=False), nullable=False, server_default="pending"),
        sa.Column("storage_key", sa.String(length=512), nullable=False),
        sa.Column("content_type", sa.String(length=120), nullable=False),
        sa.Column("byte_size", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("width", sa.Integer()),
        sa.Column("height", sa.Integer()),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("storage_key", name="uq_media_assets_storage_key"),
    )
    op.create_index("ix_media_assets_owner_status", "media_assets", ["owner_id", "status"])
