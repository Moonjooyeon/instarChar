from __future__ import annotations

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import GooglePlayAccount, User


class GooglePlayAccountsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def save(self, user_id: UUID, account_id: str) -> None:
        statement = insert(GooglePlayAccount).values(id=uuid4(), user_id=user_id, account_id=account_id).on_conflict_do_nothing(index_elements=[GooglePlayAccount.account_id])
        await self.session.execute(statement)
        await self.session.commit()

    async def user(self, account_id: str) -> User | None:
        statement = select(User).join(GooglePlayAccount, GooglePlayAccount.user_id == User.id).where(GooglePlayAccount.account_id == account_id)
        return (await self.session.execute(statement)).scalar_one_or_none()
