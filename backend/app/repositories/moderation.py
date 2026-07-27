from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequestError, NotFoundError
from app.models import Character, ContentReport, ReportStatus, SharedCharacter, SharedDmThread, User, UserBlock, UserModerationStatus, UserPolicyConsent
from app.schemas.moderation import ContentReportCreate, ModerationDecision


class ModerationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def consent_status(self, user_id: UUID, version: str) -> bool:
        stmt = select(UserPolicyConsent.id).where(UserPolicyConsent.user_id == user_id, UserPolicyConsent.terms_version == version)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def accept_terms(self, user_id: UUID, version: str) -> None:
        stmt = insert(UserPolicyConsent).values(user_id=user_id, terms_version=version)
        await self.session.execute(stmt.on_conflict_do_nothing(index_elements=["user_id", "terms_version"]))
        await self.session.commit()

    async def create_report(self, user_id: UUID, payload: ContentReportCreate) -> ContentReport:
        data = payload.model_dump(mode="python")
        data["target_owner_id"] = await self._target_owner(user_id, payload)
        row = ContentReport(reporter_id=user_id, **data)
        self.session.add(row)
        await self.session.commit()
        await self.session.refresh(row)
        return row

    async def block_user(self, blocker_id: UUID, blocked_id: UUID) -> None:
        if blocker_id == blocked_id:
            raise BadRequestError("You cannot block your own account")
        if not await self._existing_user_id(blocked_id):
            raise BadRequestError("User to block could not be found")
        stmt = insert(UserBlock).values(blocker_id=blocker_id, blocked_id=blocked_id)
        await self.session.execute(stmt.on_conflict_do_nothing(index_elements=["blocker_id", "blocked_id"]))
        await self.session.commit()

    async def unblock_user(self, blocker_id: UUID, blocked_id: UUID) -> None:
        stmt = delete(UserBlock).where(UserBlock.blocker_id == blocker_id, UserBlock.blocked_id == blocked_id)
        await self.session.execute(stmt)
        await self.session.commit()

    async def blocked_ids(self, blocker_id: UUID) -> list[UUID]:
        result = await self.session.execute(select(UserBlock.blocked_id).where(UserBlock.blocker_id == blocker_id))
        return list(result.scalars().all())

    async def blocked_between(self, first_id: UUID, other_ids: list[UUID]) -> bool:
        peers = [item for item in other_ids if item != first_id]
        if not peers:
            return False
        stmt = select(UserBlock.id).where(((UserBlock.blocker_id == first_id) & UserBlock.blocked_id.in_(peers)) | ((UserBlock.blocked_id == first_id) & UserBlock.blocker_id.in_(peers)))
        result = await self.session.execute(stmt.limit(1))
        return result.scalar_one_or_none() is not None

    async def reports(self, status: ReportStatus | None) -> list[ContentReport]:
        stmt = select(ContentReport).order_by(ContentReport.created_at.asc()).limit(200)
        result = await self.session.execute(stmt.where(ContentReport.status == status) if status else stmt)
        return list(result.scalars().all())

    async def decide(self, report_id: UUID, payload: ModerationDecision, actor: str) -> ContentReport:
        report = await self._report(report_id)
        report.status = ReportStatus(payload.status)
        report.resolution_action = payload.resolution_action
        report.moderator_note = payload.moderator_note
        report.resolved_by = actor
        report.resolved_at = self._resolved_at(payload.status)
        await self._apply_content_removal(report, payload)
        await self._apply_user_status(report, payload)
        await self.session.commit()
        await self.session.refresh(report)
        return report

    async def _report(self, report_id: UUID) -> ContentReport:
        result = await self.session.execute(select(ContentReport).where(ContentReport.id == report_id).with_for_update())
        report = result.scalar_one_or_none()
        if report:
            return report
        raise NotFoundError("Report not found")

    async def _apply_user_status(self, report: ContentReport, payload: ModerationDecision) -> None:
        if not payload.target_user_status or not report.target_owner_id:
            return
        result = await self.session.execute(select(User).where(User.id == report.target_owner_id).with_for_update())
        user = result.scalar_one_or_none()
        if user:
            user.moderation_status = UserModerationStatus(payload.target_user_status)

    async def _apply_content_removal(self, report: ContentReport, payload: ModerationDecision) -> None:
        if payload.resolution_action != "content_removed":
            return
        if report.target_type == "character":
            await self._remove_shared_character(report.target_reference)
        elif report.target_type in {"post", "comment", "ai_content"}:
            await self._remove_feed_content(report)
        elif report.target_type == "dm_message":
            await self._remove_dm_message(report.target_reference)

    async def _remove_shared_character(self, reference: str) -> None:
        shared_id = self._uuid(reference)
        if shared_id:
            await self.session.execute(delete(SharedCharacter).where(SharedCharacter.id == shared_id))

    async def _remove_feed_content(self, report: ContentReport) -> None:
        parts = report.target_reference.split(":")
        row = await self._reported_character(report, parts[0])
        if not row or len(parts) < 2:
            return
        row.posts = self._filtered_posts(list(row.posts or []), parts[1], parts[2] if len(parts) > 2 else None)
        await self._sync_shared_posts(row)

    async def _reported_character(self, report: ContentReport, reference: str) -> Character | None:
        character_id = self._uuid(reference)
        stmt = select(Character).where(Character.id == character_id) if character_id else select(Character).where(Character.owner_id == report.reporter_id, Character.source_account_id == reference)
        result = await self.session.execute(stmt.with_for_update())
        return result.scalar_one_or_none()

    async def _sync_shared_posts(self, row: Character) -> None:
        stmt = select(SharedCharacter).where(SharedCharacter.owner_id == row.owner_id, SharedCharacter.source_account_id == row.source_account_id)
        result = await self.session.execute(stmt)
        shared = result.scalar_one_or_none()
        if shared:
            shared.character = {**dict(shared.character or {}), "posts": list(row.posts or [])}

    async def _remove_dm_message(self, reference: str) -> None:
        thread_key, separator, index_text = reference.rpartition(":")
        if not separator or not index_text.isdigit():
            return
        result = await self.session.execute(select(SharedDmThread).where(SharedDmThread.thread_key == thread_key).with_for_update())
        row = result.scalar_one_or_none()
        if row:
            row.messages = [item for index, item in enumerate(row.messages or []) if index != int(index_text)]

    def _filtered_posts(self, posts: list[object], post_id: str, comment_index: str | None) -> list[object]:
        if comment_index is None:
            return [post for post in posts if str(self._record(post).get("id")) != post_id]
        if not comment_index.isdigit():
            return posts
        return [self._without_comment(post, post_id, int(comment_index)) for post in posts]

    def _without_comment(self, value: object, post_id: str, index: int) -> object:
        post = self._record(value)
        if str(post.get("id")) != post_id:
            return value
        return {**post, "comments": [item for item_index, item in enumerate(self._list(post.get("comments"))) if item_index != index]}

    def _uuid(self, value: str) -> UUID | None:
        try:
            return UUID(value)
        except ValueError:
            return None

    def _record(self, value: object) -> dict[str, object]:
        return value if isinstance(value, dict) else {}

    def _list(self, value: object) -> list[object]:
        return value if isinstance(value, list) else []

    async def _target_owner(self, reporter_id: UUID, payload: ContentReportCreate) -> UUID | None:
        owner_id = await self._resolved_target_owner(reporter_id, payload)
        if payload.target_type == "ai_content":
            return None
        if not owner_id:
            raise BadRequestError("Reported content could not be found")
        if owner_id == reporter_id:
            raise BadRequestError("You cannot report your own content")
        return owner_id

    async def _resolved_target_owner(self, reporter_id: UUID, payload: ContentReportCreate) -> UUID | None:
        if payload.target_type == "character":
            return await self._shared_character_owner(payload.target_reference)
        if payload.target_type in {"post", "comment"}:
            return await self._character_owner(payload.target_reference.split(":")[0])
        if payload.target_type == "dm_message":
            return await self._dm_peer_owner(payload.target_reference, reporter_id)
        if payload.target_type == "user":
            return await self._existing_user_id(payload.target_owner_id)
        return None

    async def _shared_character_owner(self, reference: str) -> UUID | None:
        target_id = self._uuid(reference)
        if not target_id:
            return None
        result = await self.session.execute(select(SharedCharacter.owner_id).where(SharedCharacter.id == target_id))
        return result.scalar_one_or_none()

    async def _character_owner(self, reference: str) -> UUID | None:
        target_id = self._uuid(reference)
        if not target_id:
            return None
        result = await self.session.execute(select(Character.owner_id).where(Character.id == target_id))
        return result.scalar_one_or_none()

    async def _dm_peer_owner(self, reference: str, reporter_id: UUID) -> UUID | None:
        thread_key, separator, _ = reference.rpartition(":")
        if not separator:
            return None
        result = await self.session.execute(select(SharedDmThread.participant_user_ids).where(SharedDmThread.thread_key == thread_key))
        ids = result.scalar_one_or_none() or []
        return next((item for item in ids if item != reporter_id), None)

    async def _existing_user_id(self, target_id: UUID | None) -> UUID | None:
        if not target_id:
            return None
        result = await self.session.execute(select(User.id).where(User.id == target_id))
        return result.scalar_one_or_none()

    def _resolved_at(self, status: str) -> datetime | None:
        return datetime.now(timezone.utc) if status in {"resolved", "dismissed"} else None
