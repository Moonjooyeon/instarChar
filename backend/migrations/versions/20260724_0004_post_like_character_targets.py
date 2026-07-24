"""Use character ids for post like targets.

Revision ID: 20260724_0004
Revises: 20260724_0003
Create Date: 2026-07-24
"""

from collections.abc import Sequence
from typing import Optional, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260724_0004"
down_revision: Optional[str] = "20260724_0003"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    op.add_column("character_post_likes", sa.Column("target_character_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.execute("""
        UPDATE character_post_likes AS likes
        SET target_character_id = characters.id
        FROM shared_characters AS shared, characters
        WHERE likes.target_shared_character_id = shared.id
          AND characters.owner_id = shared.owner_id
          AND characters.source_account_id = shared.source_account_id
    """)
    op.alter_column("character_post_likes", "target_character_id", nullable=False)
    op.drop_index("ix_character_post_likes_target", table_name="character_post_likes")
    op.drop_constraint("uq_character_post_likes", "character_post_likes", type_="unique")
    op.drop_column("character_post_likes", "target_shared_character_id")
    op.create_foreign_key("fk_post_likes_target_character", "character_post_likes", "characters", ["target_character_id"], ["id"], ondelete="CASCADE")
    op.create_unique_constraint("uq_character_post_likes", "character_post_likes", ["liker_owner_id", "liker_account_id", "target_character_id", "target_post_id"])
    op.create_index("ix_character_post_likes_target", "character_post_likes", ["target_character_id", "target_post_id"])


def downgrade() -> None:
    op.add_column("character_post_likes", sa.Column("target_shared_character_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.execute("""
        UPDATE character_post_likes AS likes
        SET target_shared_character_id = shared.id
        FROM characters, shared_characters AS shared
        WHERE likes.target_character_id = characters.id
          AND shared.owner_id = characters.owner_id
          AND shared.source_account_id = characters.source_account_id
    """)
    op.execute("DELETE FROM character_post_likes WHERE target_shared_character_id IS NULL")
    op.alter_column("character_post_likes", "target_shared_character_id", nullable=False)
    op.drop_index("ix_character_post_likes_target", table_name="character_post_likes")
    op.drop_constraint("uq_character_post_likes", "character_post_likes", type_="unique")
    op.drop_constraint("fk_post_likes_target_character", "character_post_likes", type_="foreignkey")
    op.drop_column("character_post_likes", "target_character_id")
    op.create_foreign_key(None, "character_post_likes", "shared_characters", ["target_shared_character_id"], ["id"], ondelete="CASCADE")
    op.create_unique_constraint("uq_character_post_likes", "character_post_likes", ["liker_owner_id", "liker_account_id", "target_shared_character_id", "target_post_id"])
    op.create_index("ix_character_post_likes_target", "character_post_likes", ["target_shared_character_id", "target_post_id"])
