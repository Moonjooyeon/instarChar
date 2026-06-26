"""Initial alive schema without Supabase auth dependencies.

Revision ID: 20260626_0001
Revises:
Create Date: 2026-06-26
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260626_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE TYPE user_provider AS ENUM ('google', 'apple')")
    _create_users()
    _create_state_tables()
    _create_social_tables()
    _create_dm_tables()


def downgrade() -> None:
    for table in ["shared_dm_threads", "dm_threads", "character_follows", "shared_characters", "personas", "characters", "profiles", "users"]:
        op.drop_table(table)
    op.execute("DROP TYPE user_provider")


def _uuid_pk() -> sa.Column[object]:
    return sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"))


def _timestamps() -> list[sa.Column[object]]:
    return [sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False)]


def _create_users() -> None:
    op.create_table("users", _uuid_pk(), sa.Column("email", sa.String(length=320), nullable=False), sa.Column("provider", sa.Enum("google", "apple", name="user_provider", create_type=False), nullable=False), sa.Column("provider_subject", sa.String(length=255), nullable=False), *_timestamps(), sa.UniqueConstraint("provider", "provider_subject", name="uq_users_provider_subject"))
    op.create_table("profiles", sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True), sa.Column("display_name", sa.String(length=120), nullable=False, server_default=""), sa.Column("onboarded", sa.Boolean(), nullable=False, server_default=sa.text("false")), sa.Column("app_state", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")), *_timestamps())


def _create_state_tables() -> None:
    op.create_table("characters", _uuid_pk(), sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("source_account_id", sa.String(length=120), nullable=False), sa.Column("name", sa.String(length=120), nullable=False, server_default=""), sa.Column("handle", sa.String(length=120), nullable=False, server_default=""), sa.Column("character", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")), sa.Column("gallery", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")), sa.Column("posts", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")), sa.Column("following", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")), *_timestamps(), sa.UniqueConstraint("owner_id", "source_account_id", name="uq_characters_owner_source"))
    op.create_table("personas", _uuid_pk(), sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("persona_id", sa.String(length=120), nullable=False), sa.Column("name", sa.String(length=120), nullable=False, server_default=""), sa.Column("persona", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")), *_timestamps(), sa.UniqueConstraint("owner_id", "persona_id", name="uq_personas_owner_persona"))


def _create_social_tables() -> None:
    op.create_table("shared_characters", _uuid_pk(), sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("owner_name", sa.String(length=120), nullable=False, server_default=""), sa.Column("source_account_id", sa.String(length=120), nullable=False), sa.Column("name", sa.String(length=120), nullable=False), sa.Column("handle", sa.String(length=120), nullable=False, server_default=""), sa.Column("persona", sa.Text(), nullable=False, server_default=""), sa.Column("tags", postgresql.ARRAY(sa.Text()), nullable=False, server_default=sa.text("ARRAY[]::text[]")), sa.Column("character", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")), *_timestamps(), sa.UniqueConstraint("owner_id", "source_account_id", name="uq_shared_characters_owner_source"))
    op.create_table("character_follows", _uuid_pk(), sa.Column("follower_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("follower_name", sa.String(length=120), nullable=False, server_default=""), sa.Column("follower_account_id", sa.String(length=120), nullable=False), sa.Column("follower_character", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")), sa.Column("target_shared_character_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shared_characters.id", ondelete="CASCADE"), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False), sa.UniqueConstraint("follower_id", "follower_account_id", "target_shared_character_id", name="uq_character_follows"))


def _create_dm_tables() -> None:
    op.create_table("dm_threads", _uuid_pk(), sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("thread_key", sa.String(length=500), nullable=False), sa.Column("messages", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")), sa.Column("world_pref", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")), *_timestamps(), sa.UniqueConstraint("owner_id", "thread_key", name="uq_dm_threads_owner_key"))
    op.create_table("shared_dm_threads", _uuid_pk(), sa.Column("thread_key", sa.String(length=500), nullable=False, unique=True), sa.Column("participant_user_ids", postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=False, server_default=sa.text("ARRAY[]::uuid[]")), sa.Column("participant_labels", postgresql.ARRAY(sa.Text()), nullable=False, server_default=sa.text("ARRAY[]::text[]")), sa.Column("messages", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")), sa.Column("world_pref", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")), sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")), *_timestamps())
