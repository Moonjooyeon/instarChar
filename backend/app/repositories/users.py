from datetime import datetime, timezone
from uuid import UUID
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import ConflictError
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

    async def get_or_create_provider_user(self, email: str, provider: UserProvider, subject: str, display_name: str) -> User:
        existing = await self.get_by_provider(provider, subject)
        if existing:
            self._restore_pending_account(existing)
            return existing
        return await self.create_provider_user(email, provider, subject, display_name)

    def _restore_pending_account(self, user: User) -> None:
        if user.account_status != UserAccountStatus.pending_deletion:
            user.auth_revoked_at = None
            return
        if user.purge_at and user.purge_at <= datetime.now(timezone.utc):
            raise ConflictError("Account deletion is being finalized")
        user.account_status = UserAccountStatus.active
        user.deletion_requested_at = None
        user.purge_at = None
        user.auth_revoked_at = None

    async def list_due_deletions(self, now: datetime, limit: int) -> list[User]:
        statement = select(User).where(User.account_status == UserAccountStatus.pending_deletion, User.purge_at <= now).order_by(User.purge_at).limit(limit)
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def delete_account(self, user: User) -> None:
        await self._remove_user_from_shared_threads(user.id)
        await self.session.delete(user)

    async def _remove_user_from_shared_threads(self, user_id: UUID) -> None:
        statement = select(SharedDmThread).where(SharedDmThread.participant_user_ids.contains([user_id]))
        result = await self.session.execute(statement)
        for thread in result.scalars():
            participants = [item for item in thread.participant_user_ids if item != user_id]
            if participants:
                thread.participant_user_ids = participants
                continue
            await self.session.delete(thread)
