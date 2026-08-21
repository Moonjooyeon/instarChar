from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import Settings
from app.repositories.ai_usage import AiUsageRepository
from app.repositories.auto_posts import AutoPostRepository, ClaimedAutoPost
from app.repositories.character_posts import CharacterPostsRepository
from app.repositories.credits import CreditRepository
from app.schemas.character_posts import FeedPostGenerateRequest
from app.services.feed_generation import FeedGenerationService, retry_delay_seconds


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
        for _ in range(self.settings.auto_post_batch_size):
            claim = await self._claim_next()
            if claim is None:
                return
            await self._process_claim(claim)

    async def _process_claim(self, claim: ClaimedAutoPost) -> None:
        try:
            await self._generate(claim)
        except asyncio.CancelledError:
            await asyncio.shield(self._release_claim_safely(claim, "SCHEDULER_CANCELLED"))
            raise
        except Exception as error:
            logger.exception("Auto-post claim failed", extra={"source_account_id": claim.source_account_id})
            await self._release_claim_safely(claim, f"SCHEDULER_UNHANDLED: {type(error).__name__}")

    async def _claim_next(self) -> ClaimedAutoPost | None:
        async with self.session_factory() as session:
            repository = AutoPostRepository(session)
            return await repository.claim_next(datetime.now(timezone.utc))

    async def _generate(self, claim: ClaimedAutoPost) -> None:
        async with self.session_factory() as session:
            posts = CharacterPostsRepository(session)
            service = FeedGenerationService(posts, AiUsageRepository(session), self.settings, CreditRepository(session))
            payload = FeedPostGenerateRequest(idempotency_key=auto_post_request_key(claim))
            await service.generate(claim.owner_id, claim.source_account_id, payload, is_auto=True, auto_claimed_at=claim.claimed_at)

    async def _release_claim_safely(self, claim: ClaimedAutoPost, message: str) -> None:
        try:
            await self._record_claim_failure(claim, message)
        except Exception:
            logger.exception("Auto-post claim release failed", extra={"source_account_id": claim.source_account_id})

    async def _record_claim_failure(self, claim: ClaimedAutoPost, message: str) -> None:
        async with self.session_factory() as session:
            posts = CharacterPostsRepository(session)
            delay = retry_delay_seconds(claim.failure_count)
            retry_at = datetime.now(timezone.utc) + timedelta(seconds=delay)
            await posts.record_auto_failure(claim.owner_id, claim.source_account_id, message, retry_at, claim.claimed_at)


def auto_post_request_key(claim: ClaimedAutoPost) -> str:
    scheduled = claim.scheduled_for.astimezone(timezone.utc).isoformat()
    return f"auto-post:{claim.source_account_id}:{scheduled}"
