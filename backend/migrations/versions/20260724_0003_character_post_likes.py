"""Add persistent character post likes.

Revision ID: 20260724_0003
Revises: 20260723_0002
Create Date: 2026-07-24
"""

from collections.abc import Sequence
from typing import Optional, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260724_0003"
down_revision: Optional[str] = "20260723_0002"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    op.create_table(
        "character_post_likes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("liker_owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("liker_account_id", sa.String(length=120), nullable=False),
        sa.Column("target_shared_character_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shared_characters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_post_id", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["liker_owner_id", "liker_account_id"], ["characters.owner_id", "characters.source_account_id"], ondelete="CASCADE", name="fk_post_likes_liker_character"),
        sa.UniqueConstraint("liker_owner_id", "liker_account_id", "target_shared_character_id", "target_post_id", name="uq_character_post_likes"),
    )
    op.create_index("ix_character_post_likes_target", "character_post_likes", ["target_shared_character_id", "target_post_id"])


def downgrade() -> None:
    op.drop_index("ix_character_post_likes_target", table_name="character_post_likes")
    op.drop_table("character_post_likes")
