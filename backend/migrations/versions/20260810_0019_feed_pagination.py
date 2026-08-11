"""Add an indexed public feed projection for cursor pagination."""

from collections.abc import Sequence
from typing import Optional, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260810_0019"
down_revision: Optional[str] = "20260810_0018"
branch_labels: Optional[Union[str, Sequence[str]]] = None
depends_on: Optional[Union[str, Sequence[str]]] = None


def upgrade() -> None:
    op.create_table(
        "public_feed_posts",
        sa.Column("author_character_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("characters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("post_id", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.PrimaryKeyConstraint("author_character_id", "post_id", name="pk_public_feed_posts"),
    )
    op.create_index("ix_public_feed_posts_cursor", "public_feed_posts", ["created_at", "post_id", "author_character_id"])
    op.create_index("ix_public_feed_posts_author_created", "public_feed_posts", ["author_character_id", "created_at", "post_id"])
    op.create_index("ix_character_follows_target_created", "character_follows", ["target_shared_character_id", "created_at"])
    op.create_index("ix_shared_characters_tags_gin", "shared_characters", ["tags"], postgresql_using="gin")
    op.execute(sa.text(_TIME_FUNCTION_SQL))
    op.execute(sa.text(_SYNC_FUNCTION_SQL))
    op.execute(sa.text(_TRIGGER_SQL))


def downgrade() -> None:
    op.execute(sa.text("DROP TRIGGER IF EXISTS sync_public_feed_posts ON characters"))
    op.execute(sa.text("DROP FUNCTION IF EXISTS sync_public_feed_posts"))
    op.execute(sa.text("DROP FUNCTION IF EXISTS public_feed_post_time"))
    op.drop_index("ix_shared_characters_tags_gin", table_name="shared_characters")
    op.drop_index("ix_character_follows_target_created", table_name="character_follows")
    op.drop_index("ix_public_feed_posts_author_created", table_name="public_feed_posts")
    op.drop_index("ix_public_feed_posts_cursor", table_name="public_feed_posts")
    op.drop_table("public_feed_posts")


_TIME_FUNCTION_SQL = """
CREATE FUNCTION public_feed_post_time(value text, fallback timestamptz) RETURNS timestamptz AS $$
BEGIN
  RETURN COALESCE(NULLIF(value, '')::timestamptz, fallback);
EXCEPTION WHEN OTHERS THEN
  RETURN fallback;
END;
$$ LANGUAGE plpgsql;
"""


_SYNC_FUNCTION_SQL = """
CREATE FUNCTION sync_public_feed_posts() RETURNS trigger AS $$
BEGIN
  DELETE FROM public_feed_posts AS current
  WHERE current.author_character_id = NEW.id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(NEW.posts, '[]'::jsonb)) WITH ORDINALITY AS post(value, ordinality)
      WHERE NEW.is_public IS TRUE
        AND jsonb_typeof(post.value) = 'object'
        AND NULLIF(post.value ->> 'text', '') IS NOT NULL
        AND COALESCE(NULLIF(post.value ->> 'id', ''), md5(NEW.id::text || ':' || post.ordinality::text)) = current.post_id
    );
  IF NEW.is_public IS TRUE THEN
    INSERT INTO public_feed_posts (author_character_id, post_id, created_at, payload)
    SELECT NEW.id, COALESCE(NULLIF(post.value ->> 'id', ''), md5(NEW.id::text || ':' || post.ordinality::text)), public_feed_post_time(post.value ->> 'time', NEW.created_at), jsonb_set(post.value, '{id}', to_jsonb(COALESCE(NULLIF(post.value ->> 'id', ''), md5(NEW.id::text || ':' || post.ordinality::text))), true)
    FROM jsonb_array_elements(COALESCE(NEW.posts, '[]'::jsonb)) WITH ORDINALITY AS post(value, ordinality)
    WHERE jsonb_typeof(post.value) = 'object' AND NULLIF(post.value ->> 'text', '') IS NOT NULL
    ON CONFLICT (author_character_id, post_id) DO UPDATE
    SET created_at = EXCLUDED.created_at, payload = EXCLUDED.payload
    WHERE (public_feed_posts.created_at, public_feed_posts.payload) IS DISTINCT FROM (EXCLUDED.created_at, EXCLUDED.payload);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""


_TRIGGER_SQL = """
CREATE TRIGGER sync_public_feed_posts
AFTER INSERT OR UPDATE OF posts, is_public ON characters
FOR EACH ROW EXECUTE FUNCTION sync_public_feed_posts();
"""
