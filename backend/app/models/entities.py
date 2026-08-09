from __future__ import annotations

import enum
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, Enum, ForeignKey, ForeignKeyConstraint, Index, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


JsonMap = dict[str, object]


class UserProvider(str, enum.Enum):
    google = "google"
    apple = "apple"
    toss = "toss"


class UserModerationStatus(str, enum.Enum):
    active = "active"
    suspended = "suspended"
    banned = "banned"


class UserAccountStatus(str, enum.Enum):
    active = "active"
    pending_deletion = "pending_deletion"


class ReportStatus(str, enum.Enum):
    pending = "pending"
    reviewing = "reviewing"
    resolved = "resolved"
    dismissed = "dismissed"


class MediaPurpose(str, enum.Enum):
    profile_avatar = "profile_avatar"
    profile_header = "profile_header"
    gallery = "gallery"
    feed_post = "feed_post"
    dm_attachment = "dm_attachment"


class MediaVisibility(str, enum.Enum):
    public = "public"
    private = "private"


class MediaStatus(str, enum.Enum):
    pending = "pending"
    ready = "ready"
    rejected = "rejected"
    deleted = "deleted"


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
    moderation_status: Mapped[UserModerationStatus] = mapped_column(Enum(UserModerationStatus, name="user_moderation_status"), nullable=False, default=UserModerationStatus.active)
    account_status: Mapped[UserAccountStatus] = mapped_column(Enum(UserAccountStatus, name="user_account_status"), nullable=False, default=UserAccountStatus.active)
    session_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    deletion_requested_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    purge_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    auth_revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    profile: Mapped[Profile] = relationship(back_populates="user", cascade="all, delete-orphan")


class AccountDeletionIdentity(Base):
    __tablename__ = "account_deletion_identities"
    __table_args__ = (UniqueConstraint("provider", "identity_fingerprint", name="uq_account_deletion_identities_provider_fingerprint"), Index("ix_account_deletion_identities_retention", "retention_until"))
    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    provider: Mapped[UserProvider] = mapped_column(Enum(UserProvider, name="user_provider", create_type=False), nullable=False)
    identity_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    user_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    retention_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AppleOAuthCredential(TimestampMixin, Base):
    __tablename__ = "apple_oauth_credentials"
    __table_args__ = (UniqueConstraint("user_id", "client_id", name="uq_apple_oauth_credentials_user_client"), Index("ix_apple_oauth_credentials_subject_client", "subject", "client_id"))
    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    client_id: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    refresh_token_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    access_token_encrypted: Mapped[Optional[str]] = mapped_column(Text)
    access_token_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_validated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    email_forwarding_enabled: Mapped[Optional[bool]] = mapped_column(Boolean)


class AppleAccountEvent(Base):
    __tablename__ = "apple_account_events"
    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    event_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class NativeOAuthCode(Base):
    __tablename__ = "native_oauth_codes"
    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserPolicyConsent(Base):
    __tablename__ = "user_policy_consents"
    __table_args__ = (UniqueConstraint("user_id", "terms_version", name="uq_user_policy_consents_version"),)
    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    terms_version: Mapped[str] = mapped_column(String(32), nullable=False)
    accepted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserBlock(Base):
    __tablename__ = "user_blocks"
    __table_args__ = (UniqueConstraint("blocker_id", "blocked_id", name="uq_user_blocks_pair"),)
    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    blocker_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    blocked_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ContentReport(TimestampMixin, Base):
    __tablename__ = "content_reports"
    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    reporter_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    target_type: Mapped[str] = mapped_column(String(32), nullable=False)
    target_owner_id: Mapped[Optional[UUID]] = mapped_column(PgUUID(as_uuid=True))
    target_reference: Mapped[str] = mapped_column(String(500), nullable=False)
    reason: Mapped[str] = mapped_column(String(32), nullable=False)
    detail: Mapped[str] = mapped_column(Text, nullable=False, default="")
    snapshot: Mapped[JsonMap] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[ReportStatus] = mapped_column(Enum(ReportStatus, name="report_status"), nullable=False, default=ReportStatus.pending)
    resolution_action: Mapped[str] = mapped_column(String(32), nullable=False, default="none")
    moderator_note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    resolved_by: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class Profile(TimestampMixin, Base):
    __tablename__ = "profiles"
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    onboarded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    app_state: Mapped[JsonMap] = mapped_column(JSONB, nullable=False, default=dict)
    user: Mapped[User] = relationship(back_populates="profile")


class MediaAsset(TimestampMixin, Base):
    __tablename__ = "media_assets"
    __table_args__ = (UniqueConstraint("storage_key", name="uq_media_assets_storage_key"), Index("ix_media_assets_owner_status", "owner_id", "status"))
    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    source_account_id: Mapped[Optional[str]] = mapped_column(String(120))
    purpose: Mapped[MediaPurpose] = mapped_column(Enum(MediaPurpose, name="media_purpose"), nullable=False)
    visibility: Mapped[MediaVisibility] = mapped_column(Enum(MediaVisibility, name="media_visibility"), nullable=False)
    status: Mapped[MediaStatus] = mapped_column(Enum(MediaStatus, name="media_status"), nullable=False, default=MediaStatus.pending)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    content_type: Mapped[str] = mapped_column(String(120), nullable=False)
    byte_size: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    width: Mapped[Optional[int]] = mapped_column(Integer)
    height: Mapped[Optional[int]] = mapped_column(Integer)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class Character(TimestampMixin, Base):
    __tablename__ = "characters"
    __table_args__ = (
        UniqueConstraint("owner_id", "source_account_id", name="uq_characters_owner_source"),
        UniqueConstraint("handle", name="uq_characters_handle"),
        CheckConstraint("handle ~ '^[a-z0-9]([a-z0-9._-]{0,22}[a-z0-9])?$'", name="ck_characters_handle_format"),
        CheckConstraint("handle NOT IN ('admin', 'administrator', 'alive', 'help', 'mod', 'moderator', 'official', 'staff', 'support', 'system')", name="ck_characters_handle_reserved"),
    )
    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    source_account_id: Mapped[str] = mapped_column(String(120), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    handle: Mapped[str] = mapped_column(String(24), nullable=False)
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
    actual_cost_usd: Mapped[Decimal] = mapped_column(Numeric(14, 8), nullable=False, default=Decimal("0"))


class AiMonthlyUsage(TimestampMixin, Base):
    __tablename__ = "ai_monthly_usage"
    usage_month: Mapped[str] = mapped_column(String(7), primary_key=True)
    call_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    estimated_cost_usd: Mapped[Decimal] = mapped_column(Numeric(12, 6), nullable=False, default=Decimal("0"))
    actual_cost_usd: Mapped[Decimal] = mapped_column(Numeric(14, 8), nullable=False, default=Decimal("0"))


class CreditAccount(TimestampMixin, Base):
    __tablename__ = "credit_accounts"
    __table_args__ = (CheckConstraint("purchased_credits >= 0", name="ck_credit_accounts_purchased_nonnegative"), CheckConstraint("bonus_credits >= 0", name="ck_credit_accounts_bonus_nonnegative"), CheckConstraint("version >= 0", name="ck_credit_accounts_version_nonnegative"))
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    purchased_credits: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    bonus_credits: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class EnergyAccount(TimestampMixin, Base):
    __tablename__ = "energy_accounts"
    __table_args__ = (CheckConstraint("energy_percent BETWEEN 0 AND 100", name="ck_energy_accounts_percent"),)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    energy_percent: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    last_recovered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CreditLedgerEntry(Base):
    __tablename__ = "credit_ledger_entries"
    __table_args__ = (UniqueConstraint("user_id", "idempotency_key", name="uq_credit_ledger_user_idempotency"), Index("ix_credit_ledger_user_created", "user_id", "created_at"))
    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    entry_type: Mapped[str] = mapped_column(String(32), nullable=False)
    balance_type: Mapped[str] = mapped_column(String(16), nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(180), nullable=False)
    entry_metadata: Mapped[JsonMap] = mapped_column("metadata", JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class RewardGrant(Base):
    __tablename__ = "reward_grants"
    __table_args__ = (UniqueConstraint("user_id", "event_code", name="uq_reward_grants_user_event"),)
    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    event_code: Mapped[str] = mapped_column(String(64), nullable=False)
    credits: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CreditUsage(TimestampMixin, Base):
    __tablename__ = "credit_usages"
    __table_args__ = (UniqueConstraint("user_id", "idempotency_key", name="uq_credit_usages_user_idempotency"), Index("ix_credit_usages_user_created", "user_id", "created_at"), CheckConstraint("credits >= 0", name="ck_credit_usages_credits_nonnegative"), CheckConstraint("energy_percent >= 0", name="ck_credit_usages_energy_nonnegative"))
    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    flow: Mapped[str] = mapped_column(String(64), nullable=False)
    policy_version: Mapped[str] = mapped_column(String(64), nullable=False)
    model: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="reserved")
    credits: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    energy_percent: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    bonus_credits: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    purchased_credits: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    idempotency_key: Mapped[str] = mapped_column(String(180), nullable=False)
    provider_status: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    provider_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    thought_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    usage_metadata_complete: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    reserved_cost_usd: Mapped[Decimal] = mapped_column(Numeric(14, 8), nullable=False, default=Decimal("0"))
    provider_cost_usd: Mapped[Decimal] = mapped_column(Numeric(14, 8), nullable=False, default=Decimal("0"))
    response_body: Mapped[JsonMap] = mapped_column(JSONB, nullable=False, default=dict)
