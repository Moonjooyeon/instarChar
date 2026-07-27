from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


ReportTarget = Literal["character", "post", "comment", "dm_message", "ai_content", "user"]
ReportReason = Literal["sexual", "harassment", "hate", "violence", "self_harm", "illegal", "impersonation", "privacy", "copyright", "spam", "other"]
ReportState = Literal["pending", "reviewing", "resolved", "dismissed"]
ResolutionAction = Literal["none", "content_removed", "user_warned", "user_suspended", "user_banned"]
UserStatus = Literal["active", "suspended", "banned"]


class ConsentResponse(BaseModel):
    accepted: bool
    terms_version: str


class ContentReportCreate(BaseModel):
    target_type: ReportTarget
    target_owner_id: Optional[UUID] = None
    target_reference: str = Field(min_length=1, max_length=500)
    reason: ReportReason
    detail: str = Field(default="", max_length=2000)
    snapshot: dict[str, object] = Field(default_factory=dict)


class ContentReportResponse(BaseModel):
    id: UUID
    status: ReportState
    created_at: datetime


class BlockedUserResponse(BaseModel):
    user_ids: list[UUID]


class ModerationReportResponse(ContentReportResponse):
    reporter_id: UUID
    target_type: ReportTarget
    target_owner_id: Optional[UUID] = None
    target_reference: str
    reason: ReportReason
    detail: str
    snapshot: dict[str, object]
    resolution_action: ResolutionAction
    moderator_note: str
    updated_at: datetime


class ModerationDecision(BaseModel):
    status: ReportState
    resolution_action: ResolutionAction = "none"
    moderator_note: str = Field(default="", max_length=4000)
    target_user_status: Optional[UserStatus] = None


class ModerationQueueResponse(BaseModel):
    reports: list[ModerationReportResponse]
