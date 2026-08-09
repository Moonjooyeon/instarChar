from datetime import datetime

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AccountDeletionIdentity, User, UserProvider


class AccountDeletionIdentityRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def upsert(self, user: User, fingerprint: str, retention_until: datetime) -> None:
        values = {"provider": user.provider, "identity_fingerprint": fingerprint, "user_id": user.id, "retention_until": retention_until}
        statement = insert(AccountDeletionIdentity).values(values)
        updates = {"user_id": statement.excluded.user_id, "retention_until": func.greatest(AccountDeletionIdentity.retention_until, statement.excluded.retention_until)}
        await self.session.execute(statement.on_conflict_do_update(index_elements=["provider", "identity_fingerprint"], set_=updates))

    async def is_blocked(self, provider: UserProvider, fingerprint: str, now: datetime) -> bool:
        statement = select(AccountDeletionIdentity.id).where(AccountDeletionIdentity.provider == provider, AccountDeletionIdentity.identity_fingerprint == fingerprint, AccountDeletionIdentity.retention_until > now).limit(1)
        result = await self.session.execute(statement)
        return result.scalar_one_or_none() is not None

    async def delete_expired(self, now: datetime) -> int:
        result = await self.session.execute(delete(AccountDeletionIdentity).where(AccountDeletionIdentity.retention_until <= now))
        return result.rowcount or 0
