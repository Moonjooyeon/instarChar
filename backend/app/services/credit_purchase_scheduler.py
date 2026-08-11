from __future__ import annotations

import asyncio
import logging

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import Settings
from app.repositories.credit_purchases import CreditPurchaseAuditReport, CreditPurchaseClaim, CreditPurchaseRepository
from app.services.credit_purchases import CreditPurchaseService


logger = logging.getLogger(__name__)


class CreditPurchaseScheduler:
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
                logger.exception("Credit purchase reconciliation poll failed")
            await asyncio.sleep(self.settings.toss_iap_reconciliation_poll_seconds)

    async def poll_once(self) -> None:
        claims = await self._claim_due()
        for claim in claims:
            await self._reconcile_safely(claim)
        if self.settings.toss_iap_audit_alerts_enabled:
            await self._audit_integrity()

    async def _claim_due(self) -> list[CreditPurchaseClaim]:
        async with self.session_factory() as session:
            return await CreditPurchaseRepository(session).claim_due(self.settings.toss_iap_reconciliation_batch_size)

    async def _reconcile_safely(self, claim: CreditPurchaseClaim) -> None:
        try:
            await self._reconcile(claim)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Credit purchase reconciliation failed for %s", claim.order_id)

    async def _reconcile(self, claim: CreditPurchaseClaim) -> None:
        async with self.session_factory() as session:
            purchases = CreditPurchaseRepository(session)
            await CreditPurchaseService(self.settings, purchases).reconcile(claim.id, claim.order_id)

    async def _audit_integrity(self) -> None:
        async with self.session_factory() as session:
            report = await CreditPurchaseRepository(session).audit(self.settings.toss_iap_reconciliation_batch_size)
        log_credit_purchase_audit(report)


def log_credit_purchase_audit(report: CreditPurchaseAuditReport) -> None:
    if not report.purchases and not report.accounts:
        return
    reasons = _audit_reason_counts(report)
    logger.error("iap_integrity_alert purchases=%s accounts=%s truncated=%s reasons=%s", len(report.purchases), len(report.accounts), report.truncated, reasons)


def _audit_reason_counts(report: CreditPurchaseAuditReport) -> dict[str, int]:
    counts: dict[str, int] = {}
    groups = [item.reasons for item in report.purchases] + [item.reasons for item in report.accounts]
    for reasons in groups:
        for reason in reasons:
            counts[reason] = counts.get(reason, 0) + 1
    return counts
