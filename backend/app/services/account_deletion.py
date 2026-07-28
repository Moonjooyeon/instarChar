import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.models import User, UserProvider
from app.repositories.apple_credentials import AppleCredentialsRepository
from app.repositories.users import UserRepository
from app.services.apple_token_revocation import AppleTokenRevoker


logger = logging.getLogger(__name__)


class AccountDeletionService:
    def __init__(self, settings: Settings, session: AsyncSession) -> None:
        self.revoker = AppleTokenRevoker(settings, AppleCredentialsRepository(session))
        self.session = session
        self.users = UserRepository(session)

    async def delete(self, user: User) -> None:
        if user.provider == UserProvider.apple:
            revoked = await self.revoker.revoke_all(user.id)
            if not revoked:
                logger.warning("Apple account %s has no stored OAuth credential to revoke", user.id)
        await self.users.delete_account(user)
        await self.session.commit()
