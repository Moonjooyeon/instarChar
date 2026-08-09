import logging
import hmac
from datetime import datetime, timedelta, timezone
from hashlib import sha256

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.models import User, UserAccountStatus, UserProvider
from app.repositories.account_deletion import AccountDeletionIdentityRepository
from app.repositories.media_assets import MediaAssetRepository
from app.repositories.apple_credentials import AppleCredentialsRepository
from app.repositories.users import UserRepository
from app.services.apple_token_revocation import AppleTokenRevoker
from app.services.media_storage import MediaStorage


logger = logging.getLogger(__name__)


class AccountDeletionService:
    def __init__(self, settings: Settings, session: AsyncSession) -> None:
        self.settings = settings
        self.revoker = AppleTokenRevoker(settings, AppleCredentialsRepository(session))
        self.storage = MediaStorage(settings)
        self.session = session
        self.users = UserRepository(session)
        self.identities = AccountDeletionIdentityRepository(session)

    async def delete(self, user: User, now: datetime | None = None) -> datetime:
        requested_at = now or datetime.now(timezone.utc)
        purge_at = requested_at + timedelta(days=self.settings.account_deletion_grace_days)
        user.account_status = UserAccountStatus.pending_deletion
        user.deletion_requested_at = requested_at
        user.purge_at = purge_at
        user.auth_revoked_at = requested_at
        await self._retain_identity(user, purge_at)
        await self.session.commit()
        return purge_at

    async def purge_due_accounts(self, batch_size: int, now: datetime | None = None) -> int:
        current_time = now or datetime.now(timezone.utc)
        users = await self.users.list_due_deletions(current_time, batch_size)
        for user in users:
            await self._purge(user)
        return len(users)

    async def purge_expired_identities(self, now: datetime | None = None) -> int:
        current_time = now or datetime.now(timezone.utc)
        deleted = await self.identities.delete_expired(current_time)
        await self.session.commit()
        return deleted

    async def _purge(self, user: User) -> None:
        await self._delete_media(user)
        await self._revoke_provider(user)
        await self.users.delete_account(user)
        await self.session.commit()

    async def _delete_media(self, user: User) -> None:
        assets = await MediaAssetRepository(self.session).list_for_owner(user.id)
        for asset in assets:
            await self.storage.delete(asset.storage_key)

    async def _revoke_provider(self, user: User) -> None:
        if user.provider != UserProvider.apple:
            return
        revoked = await self.revoker.revoke_all(user.id)
        if not revoked:
            logger.info("Apple account %s has no stored OAuth credential to revoke", user.id)

    async def _retain_identity(self, user: User, purge_at: datetime) -> None:
        retention = purge_at + timedelta(days=self.settings.account_deletion_identity_retention_days)
        await self.identities.upsert(user, identity_fingerprint(self.settings, user), retention)


def identity_fingerprint(settings: Settings, user: User) -> str:
    secret = (settings.account_identity_hash_secret or settings.auth_secret_key).encode()
    subject = f"alive:account-deletion:{user.provider.value}:{user.provider_subject}".encode()
    return hmac.new(secret, subject, sha256).hexdigest()
