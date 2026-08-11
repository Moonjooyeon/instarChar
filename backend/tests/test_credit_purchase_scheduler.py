import asyncio
from datetime import datetime, timezone
import logging
from typing import cast
from uuid import uuid4

from _pytest.logging import LogCaptureFixture
import pytest

from app.core.config import Settings
from app.models import CreditPurchase
from app.repositories.credit_purchases import CreditAccountAuditItem, CreditPurchaseAuditItem, CreditPurchaseAuditReport, CreditPurchaseClaim, CreditPurchaseRepository
from app.services.credit_purchase_scheduler import CreditPurchaseScheduler, log_credit_purchase_audit


class StubSessionContext:
    async def __aenter__(self) -> object:
        return object()

    async def __aexit__(self, exc_type: type[BaseException] | None, exc: BaseException | None, traceback: object | None) -> None:
        return None


class StubSessionFactory:
    def __call__(self) -> StubSessionContext:
        return StubSessionContext()


def test_iap_reconciliation_is_disabled_by_default() -> None:
    settings = Settings(_env_file=None)
    assert settings.toss_iap_enabled is False
    assert settings.toss_iap_purchase_enabled is False
    assert settings.toss_iap_purchase_rollout_percent == 0
    assert settings.toss_iap_reconciliation_enabled is False
    assert settings.toss_iap_audit_alerts_enabled is False
    assert settings.toss_iap_reconciliation_poll_seconds == 3600
    assert settings.toss_iap_reconciliation_batch_size == 50


def test_integrity_audit_emits_reason_counts_without_identifiers(caplog: LogCaptureFixture) -> None:
    purchase = CreditPurchaseAuditItem(cast(CreditPurchase, object()), ("stale_processing", "purchase_ledger_mismatch"))
    account = CreditAccountAuditItem(uuid4(), 10, 5, 0, 9, 5, ("purchased_balance_mismatch",))
    report = CreditPurchaseAuditReport(datetime.now(timezone.utc), [purchase], [account], True)
    with caplog.at_level(logging.ERROR):
        log_credit_purchase_audit(report)
    message = caplog.records[0].getMessage()
    assert "iap_integrity_alert" in message
    assert "stale_processing" in message
    assert str(account.user_id) not in message


def test_clean_integrity_audit_does_not_emit_error(caplog: LogCaptureFixture) -> None:
    report = CreditPurchaseAuditReport(datetime.now(timezone.utc), [], [], False)
    with caplog.at_level(logging.ERROR):
        log_credit_purchase_audit(report)
    assert caplog.records == []


def test_reconciliation_failure_log_omits_order_identifier(monkeypatch: pytest.MonkeyPatch, caplog: LogCaptureFixture) -> None:
    claim = CreditPurchaseClaim(uuid4(), "sensitive-order-id")
    scheduler = CreditPurchaseScheduler(Settings(_env_file=None), StubSessionFactory())  # type: ignore[arg-type]
    async def fail_reconciliation(value: CreditPurchaseClaim) -> None:
        raise RuntimeError("provider unavailable")
    monkeypatch.setattr(scheduler, "_reconcile", fail_reconciliation)
    with caplog.at_level(logging.ERROR):
        asyncio.run(scheduler._reconcile_safely(claim))
    message = caplog.records[0].getMessage()
    assert "reconciliation failed" in message
    assert claim.order_id not in message


def test_scheduler_runs_integrity_audit_when_enabled(monkeypatch: pytest.MonkeyPatch, caplog: LogCaptureFixture) -> None:
    report = CreditPurchaseAuditReport(datetime.now(timezone.utc), [CreditPurchaseAuditItem(cast(CreditPurchase, object()), ("status_review",))], [], False)
    async def claim_due(self: object, limit: int) -> list[CreditPurchaseClaim]:
        return []
    async def audit(self: object, limit: int) -> CreditPurchaseAuditReport:
        return report
    monkeypatch.setattr(CreditPurchaseRepository, "claim_due", claim_due)
    monkeypatch.setattr(CreditPurchaseRepository, "audit", audit)
    settings = Settings(_env_file=None, toss_iap_audit_alerts_enabled=True)
    scheduler = CreditPurchaseScheduler(settings, StubSessionFactory())  # type: ignore[arg-type]
    with caplog.at_level(logging.ERROR):
        asyncio.run(scheduler.poll_once())
    assert "status_review" in caplog.records[0].getMessage()
