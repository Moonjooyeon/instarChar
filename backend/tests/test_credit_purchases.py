from __future__ import annotations

import asyncio
from collections.abc import Callable, Coroutine
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from sqlalchemy.dialects import postgresql

from app.core.config import Settings
from app.core.credit_products import CREDIT_PRODUCTS, credit_product_by_sku
from app.core.errors import BadRequestError, ConflictError, ForbiddenError, ServiceUnavailableError
from app.models import CreditAccount, CreditLedgerEntry, CreditPurchase, User, UserProvider
from app.repositories.credit_purchases import CreditPurchaseRepository, CreditPurchaseResult
from app.services.credit_purchases import CreditPurchaseService
from app.services.toss_iap import TossIapOrder


class StubSession:
    def __init__(self) -> None:
        self.added: list[object] = []
        self.commits = 0

    def add(self, value: object) -> None:
        self.added.append(value)

    async def commit(self) -> None:
        self.commits += 1


class UpdateSession(StubSession):
    def __init__(self, rowcount: int = 0) -> None:
        super().__init__()
        self.rowcount = rowcount
        self.statements: list[object] = []

    async def execute(self, statement: object) -> object:
        self.statements.append(statement)
        return SimpleNamespace(rowcount=self.rowcount)


class StubIap:
    def __init__(self, order: TossIapOrder) -> None:
        self.order = order
        self.calls: list[tuple[str, str]] = []

    async def get_order(self, order_id: str, user_key: str = "") -> TossIapOrder:
        self.calls.append((order_id, user_key))
        return self.order


class StubPurchases:
    def __init__(self, result: CreditPurchaseResult) -> None:
        self.result = result
        self.calls: list[tuple[object, str, TossIapOrder, object]] = []

    async def apply(self, user: User, subject_hash: str, order: TossIapOrder, product: object) -> CreditPurchaseResult:
        self.calls.append((user, subject_hash, order, product))
        return self.result


def test_credit_product_requires_configured_sku() -> None:
    settings = Settings(_env_file=None, toss_iap_credit_5000_sku="sku-500")
    assert credit_product_by_sku(settings, "sku-500") == CREDIT_PRODUCTS[0]
    assert credit_product_by_sku(settings, "missing") is None


def test_grant_adds_paid_and_first_purchase_credits(monkeypatch: pytest.MonkeyPatch) -> None:
    session = StubSession()
    repository = CreditPurchaseRepository(session)  # type: ignore[arg-type]
    user_id = uuid4()
    account = CreditAccount(user_id=user_id, purchased_credits=20, bonus_credits=10, debt_credits=0)
    purchase = purchase_row(user_id, "order-1", "sku-500")
    order = toss_order("order-1", "sku-500", "PAYMENT_COMPLETED")
    monkeypatch.setattr(repository, "_user_exists", async_value(True))
    monkeypatch.setattr(repository, "_locked_account", async_value(account))
    monkeypatch.setattr(repository, "_first_purchase_bonus", async_value(50))
    result = asyncio.run(repository._grant(purchase, user_id, order))
    ledger = next(item for item in session.added if isinstance(item, CreditLedgerEntry))
    assert (result.granted_credits, account.purchased_credits, purchase.status) == (550, 570, "granted")
    assert (ledger.entry_type, ledger.amount, ledger.idempotency_key) == ("purchase", 550, "purchase:order-1")
    assert session.commits == 1


def test_purchase_repays_refund_debt_before_increasing_balance(monkeypatch: pytest.MonkeyPatch) -> None:
    session = StubSession()
    repository = CreditPurchaseRepository(session)  # type: ignore[arg-type]
    user_id = uuid4()
    account = CreditAccount(user_id=user_id, purchased_credits=0, bonus_credits=0, debt_credits=200)
    purchase = purchase_row(user_id, "order-2", "sku-500")
    monkeypatch.setattr(repository, "_user_exists", async_value(True))
    monkeypatch.setattr(repository, "_locked_account", async_value(account))
    monkeypatch.setattr(repository, "_first_purchase_bonus", async_value(0))
    result = asyncio.run(repository._grant(purchase, user_id, toss_order("order-2", "sku-500", "PAYMENT_COMPLETED")))
    assert (result.granted_credits, account.purchased_credits, account.debt_credits) == (500, 300, 0)


def test_recovered_purchase_uses_saved_credit_snapshot(monkeypatch: pytest.MonkeyPatch) -> None:
    session = StubSession()
    repository = CreditPurchaseRepository(session)  # type: ignore[arg-type]
    user_id = uuid4()
    account = CreditAccount(user_id=user_id, purchased_credits=0, bonus_credits=0, debt_credits=0)
    purchase = purchase_row(user_id, "order-snapshot", "sku-500")
    purchase.base_credits = 400
    monkeypatch.setattr(repository, "_user_exists", async_value(True))
    monkeypatch.setattr(repository, "_locked_account", async_value(account))
    monkeypatch.setattr(repository, "_first_purchase_bonus", async_value(40))
    result = asyncio.run(repository._grant(purchase, user_id, toss_order("order-snapshot", "sku-500", "PAYMENT_COMPLETED")))
    assert (result.granted_credits, account.purchased_credits) == (440, 440)


def test_refund_moves_unrecoverable_credits_to_debt(monkeypatch: pytest.MonkeyPatch) -> None:
    session = StubSession()
    repository = CreditPurchaseRepository(session)  # type: ignore[arg-type]
    user_id = uuid4()
    account = CreditAccount(user_id=user_id, purchased_credits=100, bonus_credits=0, debt_credits=0)
    purchase = purchase_row(user_id, "order-3", "sku-500", status="granted", granted=550)
    monkeypatch.setattr(repository, "_locked_account", async_value(account))
    result = asyncio.run(repository._refund(purchase, toss_order("order-3", "sku-500", "REFUNDED")))
    ledger = next(item for item in session.added if isinstance(item, CreditLedgerEntry))
    assert (account.purchased_credits, account.debt_credits, result.status) == (0, 450, "refunded")
    assert (ledger.entry_type, ledger.amount) == ("chargeback", -550)


def test_reconciliation_query_uses_skip_locked() -> None:
    repository = CreditPurchaseRepository(StubSession())  # type: ignore[arg-type]
    statement = repository.due_statement(20, datetime.now(timezone.utc))
    sql = str(statement.compile(dialect=postgresql.dialect()))
    assert "FOR UPDATE SKIP LOCKED" in sql
    assert "provider_checked_at" in sql
    assert "credit_purchases.provider =" in sql


def test_account_deletion_schedules_five_year_subject_retention() -> None:
    session = UpdateSession()
    repository = CreditPurchaseRepository(session)  # type: ignore[arg-type]
    asyncio.run(repository.retain_subject_link_for_deletion(uuid4(), datetime.now(timezone.utc)))
    sql = str(session.statements[0].compile(dialect=postgresql.dialect()))
    assert "INTERVAL '5 years'" in sql
    assert "retention_until" in sql


def test_expired_detached_purchases_are_deleted() -> None:
    session = UpdateSession(rowcount=2)
    repository = CreditPurchaseRepository(session)  # type: ignore[arg-type]
    cleared = asyncio.run(repository.delete_expired_detached_purchases(datetime.now(timezone.utc)))
    sql = str(session.statements[0].compile(dialect=postgresql.dialect()))
    assert (cleared, sql.startswith("DELETE"), "user_id IS NULL" in sql) == (2, True, True)


def test_purchase_audit_reasons_cover_stale_and_ledger_mismatches() -> None:
    repository = CreditPurchaseRepository(StubSession())  # type: ignore[arg-type]
    now = datetime.now(timezone.utc)
    stale = purchase_row(uuid4(), "order-stale", "sku-500")
    stale.created_at = now - timedelta(hours=7)
    refunded = purchase_row(uuid4(), "order-refund-audit", "sku-500", status="refunded", granted=550)
    refunded.chargeback_credits = 500
    invalid = purchase_row(uuid4(), "order-invalid-grant", "sku-500", status="granted")
    assert repository._purchase_audit_reasons(stale, 0, 0, now) == ("stale_processing",)
    assert repository._purchase_audit_reasons(refunded, 500, -400, now) == ("purchase_ledger_mismatch", "refund_amount_mismatch", "chargeback_ledger_mismatch")
    assert repository._purchase_audit_reasons(invalid, 0, 0, now) == ("grant_amount_invalid",)


@pytest.mark.parametrize("status,expected", [("PURCHASED", "review"), ("FAILED", "failed")])
def test_reconciliation_moves_terminal_provider_states_out_of_processing(monkeypatch: pytest.MonkeyPatch, status: str, expected: str) -> None:
    session = StubSession()
    repository = CreditPurchaseRepository(session)  # type: ignore[arg-type]
    purchase = purchase_row(uuid4(), "order-reconcile", "sku-500")
    monkeypatch.setattr(repository, "_purchase_by_id", async_value(purchase))
    asyncio.run(repository.reconcile(purchase.id, toss_order("order-reconcile", "sku-500", status)))
    assert (purchase.status, session.commits) == (expected, 1)


def test_reconciliation_marks_provider_sku_mismatch_for_review(monkeypatch: pytest.MonkeyPatch) -> None:
    session = StubSession()
    repository = CreditPurchaseRepository(session)  # type: ignore[arg-type]
    purchase = purchase_row(uuid4(), "order-mismatch", "sku-500")
    monkeypatch.setattr(repository, "_purchase_by_id", async_value(purchase))
    asyncio.run(repository.reconcile(purchase.id, toss_order("order-mismatch", "other-sku", "PAYMENT_COMPLETED")))
    assert (purchase.status, purchase.failure_reason) == ("review", "Provider SKU mismatch")


def test_service_uses_toss_user_and_server_product_mapping() -> None:
    settings = Settings(_env_file=None, toss_iap_enabled=True, toss_iap_credit_5000_sku="sku-500", toss_iap_subject_hmac_key="purchase-secret-at-least-32-bytes")
    order = toss_order("order-4", "sku-500", "PAYMENT_COMPLETED")
    expected = CreditPurchaseResult("order-4", "granted", 550, 550, 0, 0)
    purchases = StubPurchases(expected)
    service = CreditPurchaseService(settings, purchases, StubIap(order))  # type: ignore[arg-type]
    user = User(id=uuid4(), email="toss@example.com", provider=UserProvider.toss, provider_subject="123")
    result = asyncio.run(service.grant(user, "order-4"))
    assert result == expected
    assert purchases.calls[0][2] == order
    assert purchases.calls[0][3] == CREDIT_PRODUCTS[0]
    assert len(purchases.calls[0][1]) == 64
    assert "123" not in purchases.calls[0][1]


def test_sandbox_grant_uses_allowlisted_subject_and_synthetic_order() -> None:
    settings = Settings(_env_file=None, toss_iap_enabled=True, toss_iap_credit_5000_sku="sku-500", toss_iap_subject_hmac_key="purchase-secret-at-least-32-bytes", toss_iap_sandbox_enabled=True, toss_iap_sandbox_product_sku="sku-500")
    expected = CreditPurchaseResult("sandbox-result", "granted", 550, 550, 0, 0)
    purchases = StubPurchases(expected)
    iap = StubIap(toss_order("unused", "unused", "FAILED"))
    service = CreditPurchaseService(settings, purchases, iap)  # type: ignore[arg-type]
    settings.toss_iap_sandbox_subject_hashes = service._subject_hash("123", "sandbox")
    user = User(id=uuid4(), provider=UserProvider.toss, provider_subject="123")
    result = asyncio.run(service.grant(user, "550e8400-e29b-41d4-a716-446655440000", "sku_106", "sandbox"))
    order = purchases.calls[0][2]
    assert result == expected
    assert (order.sku, order.status, order.provider) == ("sku-500", "PAYMENT_COMPLETED", "apps_in_toss_sandbox")
    assert order.order_id.startswith("sandbox:") and len(order.order_id) == 72
    assert service._sandbox_order("550e8400-e29b-41d4-a716-446655440000", "sku-500", settings.toss_iap_sandbox_subject_hashes).order_id == order.order_id
    assert iap.calls == []


def test_sandbox_grant_creates_distinct_idempotent_orders_for_provider_uuids() -> None:
    settings = Settings(_env_file=None, toss_iap_enabled=True, toss_iap_credit_5000_sku="sku-500", toss_iap_subject_hmac_key="purchase-secret-at-least-32-bytes", toss_iap_sandbox_enabled=True, toss_iap_sandbox_product_sku="sku-500")
    service = CreditPurchaseService(settings, StubPurchases(CreditPurchaseResult("", "", 0, 0, 0, 0)), StubIap(toss_order("", "", "FAILED")))  # type: ignore[arg-type]
    subject_hash = service._subject_hash("123", "sandbox")
    settings.toss_iap_sandbox_subject_hashes = subject_hash
    first = service._sandbox_order("550e8400-e29b-41d4-a716-446655440000", "sku_106", subject_hash)
    replay = service._sandbox_order("550E8400-E29B-41D4-A716-446655440000", "sku-500", subject_hash)
    second = service._sandbox_order("550e8400-e29b-41d4-a716-446655440001", "sku_106", subject_hash)
    assert first.order_id == replay.order_id
    assert first.order_id != second.order_id


@pytest.mark.parametrize("order_id,sku", [("other-order", "sku_106"), ("550e8400-e29b-41d4-a716-446655440000", "other-sku")])
def test_sandbox_grant_rejects_invalid_order_or_product(order_id: str, sku: str) -> None:
    settings = Settings(_env_file=None, toss_iap_enabled=True, toss_iap_credit_5000_sku="sku-500", toss_iap_subject_hmac_key="purchase-secret-at-least-32-bytes", toss_iap_sandbox_enabled=True, toss_iap_sandbox_product_sku="sku-500")
    service = CreditPurchaseService(settings, StubPurchases(CreditPurchaseResult("", "", 0, 0, 0, 0)), StubIap(toss_order("", "", "FAILED")))  # type: ignore[arg-type]
    settings.toss_iap_sandbox_subject_hashes = service._subject_hash("123", "sandbox")
    with pytest.raises(BadRequestError):
        asyncio.run(service.grant(User(id=uuid4(), provider=UserProvider.toss, provider_subject="123"), order_id, sku, "sandbox"))


def test_sandbox_grant_rejects_non_allowlisted_subject() -> None:
    settings = Settings(_env_file=None, toss_iap_enabled=True, toss_iap_credit_5000_sku="sku-500", toss_iap_subject_hmac_key="purchase-secret-at-least-32-bytes", toss_iap_sandbox_enabled=True, toss_iap_sandbox_product_sku="sku-500", toss_iap_sandbox_subject_hashes="a" * 64)
    service = CreditPurchaseService(settings, StubPurchases(CreditPurchaseResult("", "", 0, 0, 0, 0)), StubIap(toss_order("", "", "FAILED")))  # type: ignore[arg-type]
    with pytest.raises(ForbiddenError, match="tester"):
        asyncio.run(service.grant(User(id=uuid4(), provider=UserProvider.toss, provider_subject="123"), "550e8400-e29b-41d4-a716-446655440000", "sku_106", "sandbox"))


def test_sandbox_grant_requires_server_feature_flag() -> None:
    settings = Settings(_env_file=None, toss_iap_enabled=True, toss_iap_credit_5000_sku="sku-500", toss_iap_subject_hmac_key="purchase-secret-at-least-32-bytes", toss_iap_sandbox_product_sku="sku-500")
    service = CreditPurchaseService(settings, StubPurchases(CreditPurchaseResult("", "", 0, 0, 0, 0)), StubIap(toss_order("", "", "FAILED")))  # type: ignore[arg-type]
    settings.toss_iap_sandbox_subject_hashes = service._subject_hash("123", "sandbox")
    with pytest.raises(ServiceUnavailableError, match="Sandbox purchases"):
        asyncio.run(service.grant(User(id=uuid4(), provider=UserProvider.toss, provider_subject="123"), "550e8400-e29b-41d4-a716-446655440000", "sku_106", "sandbox"))


def test_verified_toss_order_rejects_client_sku_mismatch() -> None:
    settings = Settings(_env_file=None, toss_iap_enabled=True, toss_iap_credit_5000_sku="sku-500", toss_iap_subject_hmac_key="purchase-secret-at-least-32-bytes")
    service = CreditPurchaseService(settings, StubPurchases(CreditPurchaseResult("", "", 0, 0, 0, 0)), StubIap(toss_order("order", "sku-500", "PAYMENT_COMPLETED")))  # type: ignore[arg-type]
    with pytest.raises(BadRequestError, match="does not match"):
        asyncio.run(service.grant(User(id=uuid4(), provider=UserProvider.toss, provider_subject="123"), "order", "other-sku", "toss"))


def test_prior_subject_purchase_prevents_repeat_first_purchase_bonus(monkeypatch: pytest.MonkeyPatch) -> None:
    session = StubSession()
    repository = CreditPurchaseRepository(session)  # type: ignore[arg-type]
    purchase = purchase_row(uuid4(), "order-rejoined", "sku-500")
    monkeypatch.setattr(repository, "_has_prior_grant", async_value(True))
    result = asyncio.run(repository._first_purchase_bonus(purchase.user_id, purchase, 500))
    assert result == 0
    assert session.added == []


def test_granted_purchase_replay_does_not_add_another_ledger(monkeypatch: pytest.MonkeyPatch) -> None:
    session = StubSession()
    repository = CreditPurchaseRepository(session)  # type: ignore[arg-type]
    user_id = uuid4()
    purchase = purchase_row(user_id, "order-5", "sku-500", status="granted", granted=550)
    account = CreditAccount(user_id=user_id, purchased_credits=550, bonus_credits=0, debt_credits=0)
    monkeypatch.setattr(repository, "_reserve", async_value(purchase))
    monkeypatch.setattr(repository, "_account", async_value(account))
    result = asyncio.run(repository.apply(User(id=user_id), "hash", toss_order("order-5", "sku-500", "PURCHASED"), CREDIT_PRODUCTS[0]))
    assert (result.status, result.granted_credits) == ("granted", 550)
    assert (session.added, session.commits) == ([], 0)


def test_refunded_purchase_cannot_be_regranted(monkeypatch: pytest.MonkeyPatch) -> None:
    repository = CreditPurchaseRepository(StubSession())  # type: ignore[arg-type]
    user_id = uuid4()
    purchase = purchase_row(user_id, "order-6", "sku-500", status="refunded", granted=550)
    monkeypatch.setattr(repository, "_reserve", async_value(purchase))
    with pytest.raises(ConflictError):
        asyncio.run(repository.apply(User(id=user_id), "hash", toss_order("order-6", "sku-500", "PAYMENT_COMPLETED"), CREDIT_PRODUCTS[0]))


@pytest.mark.parametrize("provider_status", ["FAILED", "NOT_FOUND", "MINIAPP_MISMATCH"])
def test_terminal_provider_failures_are_not_scheduled_forever(provider_status: str) -> None:
    session = StubSession()
    repository = CreditPurchaseRepository(session)  # type: ignore[arg-type]
    purchase = purchase_row(uuid4(), "order-terminal", "sku-500")
    with pytest.raises(ConflictError):
        asyncio.run(repository._not_payable(purchase, toss_order("order-terminal", "sku-500", provider_status)))
    assert purchase.status == "failed"


def test_purchase_recovery_stays_available_when_new_orders_are_disabled() -> None:
    settings = Settings(_env_file=None, toss_iap_enabled=True, toss_iap_purchase_enabled=False, toss_iap_credit_5000_sku="sku-500", toss_iap_subject_hmac_key="purchase-secret-at-least-32-bytes")
    expected = CreditPurchaseResult("order-7", "granted", 500, 500, 0, 0)
    service = CreditPurchaseService(settings, StubPurchases(expected), StubIap(toss_order("order-7", "sku-500", "PAYMENT_COMPLETED")))  # type: ignore[arg-type]
    result = asyncio.run(service.grant(User(id=uuid4(), provider=UserProvider.toss, provider_subject="123"), "order-7"))
    assert result == expected


def test_purchase_service_rejects_disabled_integration_and_non_toss_users() -> None:
    result = CreditPurchaseResult("order-8", "granted", 500, 500, 0, 0)
    disabled = CreditPurchaseService(Settings(_env_file=None), StubPurchases(result), StubIap(toss_order("order-8", "sku-500", "PAYMENT_COMPLETED")))  # type: ignore[arg-type]
    with pytest.raises(ServiceUnavailableError):
        asyncio.run(disabled.grant(User(id=uuid4(), provider=UserProvider.toss, provider_subject="123"), "order-8"))
    enabled = CreditPurchaseService(Settings(_env_file=None, toss_iap_enabled=True), StubPurchases(result), StubIap(toss_order("order-8", "sku-500", "PAYMENT_COMPLETED")))  # type: ignore[arg-type]
    with pytest.raises(ForbiddenError):
        asyncio.run(enabled.grant(User(id=uuid4(), provider=UserProvider.google, provider_subject="123"), "order-8"))


def test_purchase_service_requires_dedicated_subject_hmac_key() -> None:
    result = CreditPurchaseResult("order-9", "granted", 500, 500, 0, 0)
    settings = Settings(_env_file=None, toss_iap_enabled=True, toss_iap_credit_5000_sku="sku-500")
    service = CreditPurchaseService(settings, StubPurchases(result), StubIap(toss_order("order-9", "sku-500", "PAYMENT_COMPLETED")))  # type: ignore[arg-type]
    with pytest.raises(ServiceUnavailableError, match="identity protection"):
        asyncio.run(service.grant(User(id=uuid4(), provider=UserProvider.toss, provider_subject="123"), "order-9"))


def purchase_row(user_id: UUID, order_id: str, sku: str, status: str = "processing", granted: int = 0) -> CreditPurchase:
    return CreditPurchase(id=uuid4(), user_id=user_id, provider_order_id=order_id, provider_subject_hash="hash", sku=sku, status=status, provider_status="PAYMENT_COMPLETED", price_krw=5000, base_credits=500, product_bonus_credits=0, first_purchase_bonus_credits=50 if granted else 0, granted_credits=granted, chargeback_credits=0, failure_reason="")


def toss_order(order_id: str, sku: str, status: str) -> TossIapOrder:
    return TossIapOrder(order_id, sku, status, "2026-08-11T10:00:00", "")


def async_value(value: object) -> Callable[..., Coroutine[object, object, object]]:
    async def result(*args: object, **kwargs: object) -> object:
        return value
    return result
