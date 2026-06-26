from __future__ import annotations

import enum
from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import ARRAY, Boolean, DateTime, Enum, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PgUUID
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
    following: Mapped[list[object]] = mapped_column(JSONB, nullable=False, default=list)


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
