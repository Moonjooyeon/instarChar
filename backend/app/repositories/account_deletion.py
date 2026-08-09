from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AccountDeletionIdentity, User


class AccountDeletionIdentityRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def upsert(self, user: User, fingerprint: str, retention_until: datetime) -> None:
        statement = select(AccountDeletionIdentity).where(AccountDeletionIdentity.provider == user.provider, AccountDeletionIdentity.identity_fingerprint == fingerprint)
        result = await self.session.execute(statement)
        identity = result.scalar_one_or_none()
        if identity:
            identity.user_id = user.id
            identity.retention_until = max(identity.retention_until, retention_until)
            return
        self.session.add(AccountDeletionIdentity(provider=user.provider, identity_fingerprint=fingerprint, user_id=user.id, retention_until=retention_until))

    async def delete_expired(self, now: datetime) -> int:
        result = await self.session.execute(delete(AccountDeletionIdentity).where(AccountDeletionIdentity.retention_until <= now))
        return result.rowcount or 0
