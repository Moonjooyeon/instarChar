from uuid import UUID
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Profile, User, UserProvider


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
            return existing
        return await self.create_provider_user(email, provider, subject, display_name)
