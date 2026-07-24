from __future__ import annotations

import enum
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, ForeignKeyConstraint, Index, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


JsonMap = dict[str, object]


class UserProvider(str, enum.Enum):
    google = "google"
    apple = "apple"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class User(TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("provider", "provider_subject", name="uq_users_provider_subject"),)
    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    provider: Mapped[UserProvider] = mapped_column(Enum(UserProvider, name="user_provider"), nullable=False)
    provider_subject: Mapped[str] = mapped_column(String(255), nullable=False)
    profile: Mapped[Profile] = relationship(back_populates="user", cascade="all, delete-orphan")


class NativeOAuthCode(Base):
    __tablename__ = "native_oauth_codes"
    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Profile(TimestampMixin, Base):
    __tablename__ = "profiles"
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    onboarded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    app_state: Mapped[JsonMap] = mapped_column(JSONB, nullable=False, default=dict)
    user: Mapped[User] = relationship(back_populates="profile")


class Character(TimestampMixin, Base):
    __tablename__ = "characters"
    __table_args__ = (UniqueConstraint("owner_id", "source_account_id", name="uq_characters_owner_source"),)
    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    source_account_id: Mapped[str] = mapped_column(String(120), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    handle: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    character: Mapped[JsonMap] = mapped_column(JSONB, nullable=False, default=dict)
    gallery: Mapped[list[object]] = mapped_column(JSONB, nullable=False, default=list)
    posts: Mapped[list[object]] = mapped_column(JSONB, nullable=False, default=list)
    posts_revision: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    following: Mapped[list[object]] = mapped_column(JSONB, nullable=False, default=list)
    auto_post_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    auto_post_interval_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=900)
    next_auto_post_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_auto_post_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_auto_post_error: Mapped[str] = mapped_column(Text, nullable=False, default="")
    auto_post_failure_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class UserPersona(TimestampMixin, Base):
    __tablename__ = "personas"
    __table_args__ = (UniqueConstraint("owner_id", "persona_id", name="uq_personas_owner_persona"),)
    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    persona_id: Mapped[str] = mapped_column(String(120), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    persona: Mapped[JsonMap] = mapped_column(JSONB, nullable=False, default=dict)


class SharedCharacter(TimestampMixin, Base):
    __tablename__ = "shared_characters"
    __table_args__ = (UniqueConstraint("owner_id", "source_account_id", name="uq_shared_characters_owner_source"),)
    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    owner_name: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    source_account_id: Mapped[str] = mapped_column(String(120), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    handle: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    persona: Mapped[str] = mapped_column(Text, nullable=False, default="")
    tags: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    character: Mapped[JsonMap] = mapped_column(JSONB, nullable=False, default=dict)


class CharacterFollow(Base):
    __tablename__ = "character_follows"
    __table_args__ = (UniqueConstraint("follower_id", "follower_account_id", "target_shared_character_id", name="uq_character_follows"),)
    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    follower_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    follower_name: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    follower_account_id: Mapped[str] = mapped_column(String(120), nullable=False)
    follower_character: Mapped[JsonMap] = mapped_column(JSONB, nullable=False, default=dict)
    target_shared_character_id: Mapped[UUID] = mapped_column(ForeignKey("shared_characters.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CharacterPostLike(Base):
    __tablename__ = "character_post_likes"
    __table_args__ = (
        ForeignKeyConstraint(["liker_owner_id", "liker_account_id"], ["characters.owner_id", "characters.source_account_id"], ondelete="CASCADE", name="fk_post_likes_liker_character"),
        UniqueConstraint("liker_owner_id", "liker_account_id", "target_character_id", "target_post_id", name="uq_character_post_likes"),
        Index("ix_character_post_likes_target", "target_character_id", "target_post_id"),
    )
    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    liker_owner_id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), nullable=False)
    liker_account_id: Mapped[str] = mapped_column(String(120), nullable=False)
    target_character_id: Mapped[UUID] = mapped_column(ForeignKey("characters.id", ondelete="CASCADE", name="fk_post_likes_target_character"), nullable=False)
    target_post_id: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DmThread(TimestampMixin, Base):
    __tablename__ = "dm_threads"
    __table_args__ = (UniqueConstraint("owner_id", "thread_key", name="uq_dm_threads_owner_key"),)
    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    thread_key: Mapped[str] = mapped_column(String(500), nullable=False)
    messages: Mapped[list[object]] = mapped_column(JSONB, nullable=False, default=list)
    world_pref: Mapped[JsonMap] = mapped_column(JSONB, nullable=False, default=dict)


class SharedDmThread(TimestampMixin, Base):
    __tablename__ = "shared_dm_threads"
    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    thread_key: Mapped[str] = mapped_column(String(500), nullable=False, unique=True)
    participant_user_ids: Mapped[list[UUID]] = mapped_column(ARRAY(PgUUID(as_uuid=True)), nullable=False, default=list)
    participant_labels: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    messages: Mapped[list[object]] = mapped_column(JSONB, nullable=False, default=list)
    world_pref: Mapped[JsonMap] = mapped_column(JSONB, nullable=False, default=dict)
    created_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


class AiDailyUsage(TimestampMixin, Base):
    __tablename__ = "ai_daily_usage"
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    usage_date: Mapped[date] = mapped_column(Date, primary_key=True)
    call_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    estimated_cost_usd: Mapped[Decimal] = mapped_column(Numeric(12, 6), nullable=False, default=Decimal("0"))


class AiMonthlyUsage(TimestampMixin, Base):
    __tablename__ = "ai_monthly_usage"
    usage_month: Mapped[str] = mapped_column(String(7), primary_key=True)
    call_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    estimated_cost_usd: Mapped[Decimal] = mapped_column(Numeric(12, 6), nullable=False, default=Decimal("0"))
