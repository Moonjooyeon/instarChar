from __future__ import annotations

import asyncio
import logging
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import Settings
from app.services.account_deletion import AccountDeletionService


logger = logging.getLogger(__name__)


class AccountDeletionScheduler:
    def __init__(self, settings: Settings, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self.settings = settings
        self.session_factory = session_factory

    async def run(self) -> None:
        while True:
            try:
                await self.poll_once()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Account deletion scheduler poll failed")
            await asyncio.sleep(self.settings.account_deletion_poll_seconds)

    async def poll_once(self) -> int:
        async with self.session_factory() as session:
            service = AccountDeletionService(self.settings, session)
            purged_accounts = await service.purge_due_accounts(self.settings.account_deletion_batch_size)
            await service.purge_expired_identities()
            return purged_accounts
