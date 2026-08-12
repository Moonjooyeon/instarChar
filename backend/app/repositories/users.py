from datetime import datetime, timezone
from uuid import UUID
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import ConflictError
from app.repositories.account_deletion import AccountDeletionIdentityRepository
from app.models import Profile, SharedDmThread, User, UserAccountStatus, UserProvider


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_provider(self, provider: UserProvider, subject: str) -> Optional[User]:
        result = await self.session.execute(select(User).where(User.provider == provider, User.provider_subject == subject))
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: UUID) -> Optional[User]:
        result = await self.session.execute(select(User).options(selectinload(User.profile)).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def create_provider_user(self, email: str, provider: UserProvider, subject: str, display_name: str) -> User:
        user = User(email=email, provider=provider, provider_subject=subject)
        user.profile = Profile(display_name=display_name, onboarded=False, app_state={})
        self.session.add(user)
        await self.session.flush()
        return user

    async def get_or_create_provider_user(self, email: str, provider: UserProvider, subject: str, display_name: str, deletion_fingerprint: str = "") -> User:
        existing = await self.get_by_provider(provider, subject)
        if existing:
            self._restore_pending_account(existing)
            return existing
        if deletion_fingerprint and await AccountDeletionIdentityRepository(self.session).is_blocked(provider, deletion_fingerprint, datetime.now(timezone.utc)):
            raise ConflictError("Account recreation is unavailable during the retention period")
        return await self.create_provider_user(email, provider, subject, display_name)

    def _restore_pending_account(self, user: User) -> None:
        if user.account_status != UserAccountStatus.pending_deletion:
            user.auth_revoked_at = None
            return
        if user.purge_at and user.purge_at <= datetime.now(timezone.utc):
            raise ConflictError("Account deletion is being finalized")
        user.session_version = getattr(user, "session_version", 0) + 1
        user.account_status = UserAccountStatus.active
        user.deletion_requested_at = None
        user.purge_at = None
        user.auth_revoked_at = None

    async def claim_due_deletion(self, now: datetime, excluded_user_ids: set[UUID] | None = None) -> Optional[User]:
        statement = self.due_deletion_statement(now, excluded_user_ids)
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    def due_deletion_statement(self, now: datetime, excluded_user_ids: set[UUID] | None = None) -> object:
        statement = select(User).where(User.account_status == UserAccountStatus.pending_deletion, User.purge_at <= now)
        if excluded_user_ids:
            statement = statement.where(User.id.not_in(excluded_user_ids))
        return statement.order_by(User.purge_at).limit(1).with_for_update(skip_locked=True)

    async def delete_account(self, user: User) -> None:
        await self._remove_user_from_shared_threads(user.id)
        await self.session.delete(user)

    async def revoke_sessions(self, user: User) -> None:
        user.session_version += 1
        await self.session.commit()

    async def _remove_user_from_shared_threads(self, user_id: UUID) -> None:
        statement = select(SharedDmThread).where(SharedDmThread.participant_user_ids.contains([user_id]))
        result = await self.session.execute(statement)
        for thread in result.scalars():
            participant_ids = list(thread.participant_user_ids or [])
            participant_labels = list(thread.participant_labels or [])
            remaining_indexes = [index for index, participant_id in enumerate(participant_ids) if participant_id != user_id]
            participants = [participant_ids[index] for index in remaining_indexes]
            thread.participant_labels = [participant_labels[index] for index in remaining_indexes if index < len(participant_labels)]
            if participants:
                thread.participant_user_ids = participants
                continue
            await self.session.delete(thread)
