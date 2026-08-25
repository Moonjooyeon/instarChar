from __future__ import annotations

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AppStoreAccount, User


class AppStoreAccountsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def token(self, user_id: UUID) -> UUID:
        saved = await self._saved_token(user_id)
        if saved:
            return saved
        await self._insert(user_id)
        await self.session.commit()
        return await self._required_token(user_id)

    async def user(self, token: UUID) -> User | None:
        statement = select(User).join(AppStoreAccount, AppStoreAccount.user_id == User.id).where(AppStoreAccount.account_token == token)
        return (await self.session.execute(statement)).scalar_one_or_none()

    async def _saved_token(self, user_id: UUID) -> UUID | None:
        statement = select(AppStoreAccount.account_token).where(AppStoreAccount.user_id == user_id)
        return (await self.session.execute(statement)).scalar_one_or_none()

    async def _insert(self, user_id: UUID) -> None:
        statement = insert(AppStoreAccount).values(id=uuid4(), user_id=user_id, account_token=uuid4()).on_conflict_do_nothing(index_elements=[AppStoreAccount.user_id])
        await self.session.execute(statement)

    async def _required_token(self, user_id: UUID) -> UUID:
        token = await self._saved_token(user_id)
        if token is None:
            raise RuntimeError("App Store account token was not saved")
        return token
