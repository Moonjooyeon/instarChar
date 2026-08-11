"""Add feed request limits and rebuild the tags index concurrently."""

from collections.abc import Sequence
from typing import Optional, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260810_0020"
down_revision: Optional[str] = "20260810_0019"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    op.create_table(
        "feed_request_limits",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("request_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("window_started_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("user_id", name="pk_feed_request_limits"),
    )
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY ix_shared_characters_tags_gin")
        op.create_index("ix_shared_characters_tags_gin", "shared_characters", ["tags"], postgresql_using="gin", postgresql_concurrently=True)


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index("ix_shared_characters_tags_gin", table_name="shared_characters", postgresql_concurrently=True)
        op.create_index("ix_shared_characters_tags_gin", "shared_characters", ["tags"], postgresql_using="gin")
    op.drop_table("feed_request_limits")
