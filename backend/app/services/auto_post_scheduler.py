from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import Settings
from app.repositories.ai_usage import AiUsageRepository
from app.repositories.auto_posts import AutoPostRepository, ClaimedAutoPost
from app.repositories.character_posts import CharacterPostsRepository
from app.repositories.credits import CreditRepository
from app.schemas.character_posts import FeedPostGenerateRequest
from app.services.feed_generation import FeedGenerationService


logger = logging.getLogger(__name__)


class AutoPostScheduler:
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
                logger.exception("Auto-post scheduler poll failed")
            await asyncio.sleep(self.settings.auto_post_poll_seconds)

    async def poll_once(self) -> None:
        claims = await self._claim_due()
        for claim in claims:
            await self._generate(claim)

    async def _claim_due(self) -> list[ClaimedAutoPost]:
        async with self.session_factory() as session:
            repository = AutoPostRepository(session)
            return await repository.claim_due(datetime.now(timezone.utc), self.settings.auto_post_batch_size)

    async def _generate(self, claim: ClaimedAutoPost) -> None:
        async with self.session_factory() as session:
            posts = CharacterPostsRepository(session)
            service = FeedGenerationService(posts, AiUsageRepository(session), self.settings, CreditRepository(session))
            payload = FeedPostGenerateRequest(idempotency_key=auto_post_request_key(claim))
            await service.generate(claim.owner_id, claim.source_account_id, payload, is_auto=True)


def auto_post_request_key(claim: ClaimedAutoPost) -> str:
    scheduled = claim.scheduled_for.astimezone(timezone.utc).isoformat()
    return f"auto-post:{claim.source_account_id}:{scheduled}"
