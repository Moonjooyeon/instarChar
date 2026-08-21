from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from uuid import UUID, uuid4

from sqlalchemy import and_, case, delete, func, literal, or_, select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select
from sqlalchemy.sql.selectable import ScalarSelect

from app.core.credit_products import FIRST_PURCHASE_BONUS_PERCENT, CreditProduct
from app.core.errors import BadRequestError, ConflictError
from app.models import CreditAccount, CreditLedgerEntry, CreditPurchase, RewardGrant, User
from app.services.purchase_orders import PurchaseOrder


FIRST_PURCHASE_EVENT = "first_purchase"
SANDBOX_FIRST_PURCHASE_EVENT = "first_purchase_sandbox"
PURCHASE_AUDIT_STALE_AFTER = timedelta(hours=6)
TOSS_PURCHASE_PROVIDER = "apps_in_toss"


@dataclass(frozen=True)
class CreditPurchaseResult:
    order_id: str
    status: str
    granted_credits: int
    purchased_credits: int
    bonus_credits: int
    debt_credits: int


@dataclass(frozen=True)
class CreditPurchaseClaim:
    id: UUID
    order_id: str


@dataclass(frozen=True)
class CreditPurchaseAuditItem:
    purchase: CreditPurchase
    reasons: tuple[str, ...]


@dataclass(frozen=True)
class CreditAccountAuditItem:
    user_id: UUID
    purchased_credits: int
    bonus_credits: int
    debt_credits: int
    purchased_ledger_total: int
    bonus_ledger_total: int
    reasons: tuple[str, ...]


@dataclass(frozen=True)
class CreditPurchaseAuditReport:
    generated_at: datetime
    purchases: list[CreditPurchaseAuditItem]
    accounts: list[CreditAccountAuditItem]
    truncated: bool


class CreditPurchaseRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def apply(self, user: User, subject_hash: str, order: PurchaseOrder, product: CreditProduct) -> CreditPurchaseResult:
        purchase = await self._reserve(user.id, subject_hash, order, product)
        self._validate_owner(purchase, user.id, order.sku)
        if order.status == "REFUNDED":
            return await self._refund(purchase, order)
        if purchase.status == "granted":
            return await self._result(purchase)
        if purchase.status in ("refunded", "review"):
            raise ConflictError("Purchase cannot be granted")
        if order.status == "PURCHASED":
            return await self._review(purchase, order, "Provider completed without a local grant")
        if order.status != "PAYMENT_COMPLETED":
            return await self._not_payable(purchase, order)
        return await self._grant(purchase, user.id, order)

    async def claim_due(self, limit: int, now: datetime | None = None) -> list[CreditPurchaseClaim]:
        current = now or datetime.now(timezone.utc)
        purchases = list((await self.session.execute(self.due_statement(limit, current))).scalars().all())
        claims = [CreditPurchaseClaim(item.id, item.provider_order_id) for item in purchases]
        for purchase in purchases:
            purchase.provider_checked_at = current
        await self.session.commit()
        return claims

    async def operations(self, order_id: str) -> tuple[CreditPurchase, CreditAccount | None, list[CreditLedgerEntry]] | None:
        purchase = (await self.session.execute(select(CreditPurchase).where(CreditPurchase.provider_order_id == order_id))).scalar_one_or_none()
        if not purchase:
            return None
        account = await self._account(purchase.user_id) if purchase.user_id else None
        keys = (self._ledger_key("purchase", purchase), self._ledger_key("chargeback", purchase))
        statement = select(CreditLedgerEntry).where(CreditLedgerEntry.idempotency_key.in_(keys)).order_by(CreditLedgerEntry.created_at)
        ledger = list((await self.session.execute(statement)).scalars().all())
        return purchase, account, ledger

    async def operations_queue(self, status: str | None, limit: int) -> list[CreditPurchase]:
        statement = select(CreditPurchase)
        if status:
            statement = statement.where(CreditPurchase.status == status)
        statement = statement.order_by(CreditPurchase.provider_checked_at.asc().nullsfirst(), CreditPurchase.created_at).limit(limit)
        return list((await self.session.execute(statement)).scalars().all())

    async def history(self, user_id: UUID, limit: int = 30) -> list[CreditPurchase]:
        statement = select(CreditPurchase).where(CreditPurchase.user_id == user_id).order_by(CreditPurchase.created_at.desc()).limit(limit)
        return list((await self.session.execute(statement)).scalars().all())

    async def provider_purchase(self, user_id: UUID, provider: str, order_id: str) -> CreditPurchase | None:
        statement = select(CreditPurchase).where(CreditPurchase.user_id == user_id, CreditPurchase.provider == provider, CreditPurchase.provider_order_id == order_id)
        return (await self.session.execute(statement)).scalar_one_or_none()

    async def provider_order(self, provider: str, order_id: str) -> CreditPurchase | None:
        statement = select(CreditPurchase).where(CreditPurchase.provider == provider, CreditPurchase.provider_order_id == order_id)
        return (await self.session.execute(statement)).scalar_one_or_none()

    async def mark_provider_consumed(self, provider: str, order_id: str) -> None:
        statement = update(CreditPurchase).where(CreditPurchase.provider == provider, CreditPurchase.provider_order_id == order_id).values(provider_consumed_at=datetime.now(timezone.utc))
        await self.session.execute(statement)
        await self.session.commit()

    async def retain_subject_link_for_deletion(self, user_id: UUID, now: datetime) -> None:
        legal_until = CreditPurchase.created_at + text("INTERVAL '5 years'")
        retained_until = func.greatest(legal_until, now)
        current_until = func.coalesce(CreditPurchase.retention_until, retained_until)
        statement = update(CreditPurchase).where(CreditPurchase.user_id == user_id).values(retention_until=func.greatest(current_until, retained_until))
        await self.session.execute(statement)

    async def delete_expired_detached_purchases(self, now: datetime) -> int:
        expired = CreditPurchase.retention_until <= now
        statement = delete(CreditPurchase).where(CreditPurchase.user_id.is_(None), CreditPurchase.retention_until.is_not(None), expired)
        result = await self.session.execute(statement)
        return result.rowcount or 0

    async def audit(self, limit: int, now: datetime | None = None) -> CreditPurchaseAuditReport:
        current = now or datetime.now(timezone.utc)
        purchase_rows = list((await self.session.execute(self._purchase_audit_statement(limit + 1, current))).all())
        account_rows = list((await self.session.execute(self._account_audit_statement(limit + 1))).all())
        purchases = [CreditPurchaseAuditItem(row[0], self._purchase_audit_reasons(row[0], int(row[1]), int(row[2]), current)) for row in purchase_rows[:limit]]
        accounts = [self._account_audit_item(row[0], int(row[1]), int(row[2])) for row in account_rows[:limit]]
        return CreditPurchaseAuditReport(current, purchases, accounts, len(purchase_rows) > limit or len(account_rows) > limit)

    def due_statement(self, limit: int, now: datetime) -> Select[tuple[CreditPurchase]]:
        cutoff = now - timedelta(hours=6)
        due = or_(CreditPurchase.provider_checked_at.is_(None), CreditPurchase.provider_checked_at < cutoff)
        payable = and_(CreditPurchase.provider == TOSS_PURCHASE_PROVIDER, CreditPurchase.status.in_(("processing", "granted")))
        return select(CreditPurchase).where(payable, due).order_by(CreditPurchase.provider_checked_at.asc().nullsfirst()).limit(limit).with_for_update(skip_locked=True)

    def _purchase_audit_statement(self, limit: int, now: datetime) -> Select[tuple[CreditPurchase, int, int]]:
        purchase_total = self._purchase_ledger_total("purchase:")
        chargeback_total = self._purchase_ledger_total("chargeback:")
        active = CreditPurchase.user_id.is_not(None)
        stale = and_(CreditPurchase.status == "processing", CreditPurchase.created_at < now - PURCHASE_AUDIT_STALE_AFTER)
        invalid_grant = and_(CreditPurchase.status == "granted", CreditPurchase.granted_credits <= 0)
        bad_purchase_ledger = and_(active, CreditPurchase.status.in_(("granted", "refunded")), purchase_total != CreditPurchase.granted_credits)
        bad_refund = and_(CreditPurchase.status == "refunded", CreditPurchase.chargeback_credits != CreditPurchase.granted_credits)
        bad_chargeback_ledger = and_(active, CreditPurchase.status == "refunded", chargeback_total != -CreditPurchase.chargeback_credits)
        return select(CreditPurchase, purchase_total, chargeback_total).where(or_(stale, invalid_grant, CreditPurchase.status.in_(("review", "failed")), bad_purchase_ledger, bad_refund, bad_chargeback_ledger)).order_by(CreditPurchase.updated_at.desc()).limit(limit)

    def _account_audit_statement(self, limit: int) -> Select[tuple[CreditAccount, int, int]]:
        totals = select(CreditLedgerEntry.user_id.label("user_id"), func.coalesce(func.sum(case((CreditLedgerEntry.balance_type == "purchased", CreditLedgerEntry.amount), else_=0)), 0).label("purchased"), func.coalesce(func.sum(case((CreditLedgerEntry.balance_type == "bonus", CreditLedgerEntry.amount), else_=0)), 0).label("bonus")).group_by(CreditLedgerEntry.user_id).subquery()
        purchased = func.coalesce(totals.c.purchased, 0)
        bonus = func.coalesce(totals.c.bonus, 0)
        mismatch = or_(CreditAccount.purchased_credits - CreditAccount.debt_credits != purchased, CreditAccount.bonus_credits != bonus)
        purchase_user = select(CreditPurchase.id).where(CreditPurchase.user_id == CreditAccount.user_id).exists()
        return select(CreditAccount, purchased, bonus).outerjoin(totals, totals.c.user_id == CreditAccount.user_id).where(purchase_user, mismatch).order_by(CreditAccount.updated_at.desc()).limit(limit)

    def _purchase_ledger_total(self, prefix: str) -> ScalarSelect[int]:
        key = literal(prefix) + case((CreditPurchase.ledger_reference != "", CreditPurchase.ledger_reference), else_=CreditPurchase.provider_order_id)
        return select(func.coalesce(func.sum(CreditLedgerEntry.amount), 0)).where(CreditLedgerEntry.user_id == CreditPurchase.user_id, CreditLedgerEntry.idempotency_key == key).correlate(CreditPurchase).scalar_subquery()

    def _purchase_audit_reasons(self, purchase: CreditPurchase, purchase_total: int, chargeback_total: int, now: datetime) -> tuple[str, ...]:
        reasons = self._purchase_state_reasons(purchase, now)
        if purchase.user_id and purchase.status in ("granted", "refunded") and purchase_total != purchase.granted_credits:
            reasons.append("purchase_ledger_mismatch")
        if purchase.status == "refunded" and purchase.chargeback_credits != purchase.granted_credits:
            reasons.append("refund_amount_mismatch")
        if purchase.user_id and purchase.status == "refunded" and chargeback_total != -purchase.chargeback_credits:
            reasons.append("chargeback_ledger_mismatch")
        return tuple(reasons)

    def _purchase_state_reasons(self, purchase: CreditPurchase, now: datetime) -> list[str]:
        reasons: list[str] = []
        if purchase.status == "processing" and purchase.created_at and purchase.created_at < now - PURCHASE_AUDIT_STALE_AFTER:
            reasons.append("stale_processing")
        if purchase.status in ("review", "failed"):
            reasons.append(f"status_{purchase.status}")
        if purchase.status == "granted" and purchase.granted_credits <= 0:
            reasons.append("grant_amount_invalid")
        return reasons

    def _account_audit_item(self, account: CreditAccount, purchased_total: int, bonus_total: int) -> CreditAccountAuditItem:
        debt = int(account.debt_credits or 0)
        reasons: list[str] = []
        if account.purchased_credits - debt != purchased_total:
            reasons.append("purchased_balance_mismatch")
        if account.bonus_credits != bonus_total:
            reasons.append("bonus_balance_mismatch")
        return CreditAccountAuditItem(account.user_id, account.purchased_credits, account.bonus_credits, debt, purchased_total, bonus_total, tuple(reasons))

    async def reconcile(self, purchase_id: UUID, order: PurchaseOrder) -> None:
        purchase = await self._purchase_by_id(purchase_id)
        if not purchase:
            return
        if purchase.sku != order.sku:
            await self._save_review(purchase, order, "Provider SKU mismatch")
            return
        if order.status == "REFUNDED":
            await self._refund(purchase, order)
            return
        if await self._reconcile_processing(purchase, order):
            return
        purchase.provider_status = order.status
        purchase.provider_checked_at = datetime.now(timezone.utc)
        await self.session.commit()

    async def _reconcile_processing(self, purchase: CreditPurchase, order: PurchaseOrder) -> bool:
        if purchase.status != "processing":
            return False
        if order.status == "PAYMENT_COMPLETED" and purchase.user_id:
            await self._grant(purchase, purchase.user_id, order)
            return True
        if order.status == "PAYMENT_COMPLETED":
            await self._save_review(purchase, order, "Purchase user no longer exists")
            return True
        if order.status == "PURCHASED":
            await self._save_review(purchase, order, "Provider completed without a local grant")
            return True
        if order.status in ("FAILED", "NOT_FOUND", "MINIAPP_MISMATCH"):
            await self._save_not_payable(purchase, order)
            return True
        return False

    async def _reserve(self, user_id: UUID, subject_hash: str, order: PurchaseOrder, product: CreditProduct) -> CreditPurchase:
        purchase_id = uuid4()
        statement = insert(CreditPurchase).values(id=purchase_id, user_id=user_id, provider=order.provider, provider_order_id=order.order_id, ledger_reference=self._ledger_reference(order), provider_subject_hash=subject_hash, sku=order.sku, provider_status=order.status, price_krw=product.price_krw, base_credits=product.base_credits, product_bonus_credits=product.product_bonus_credits).on_conflict_do_nothing(index_elements=[CreditPurchase.provider, CreditPurchase.provider_order_id]).returning(CreditPurchase.id)
        await self.session.execute(statement)
        result = await self.session.execute(select(CreditPurchase).where(CreditPurchase.provider == order.provider, CreditPurchase.provider_order_id == order.order_id).with_for_update())
        return result.scalar_one()

    async def _grant(self, purchase: CreditPurchase, user_id: UUID, order: PurchaseOrder) -> CreditPurchaseResult:
        if not await self._user_exists(user_id):
            return await self._review(purchase, order, "Purchase user no longer exists")
        account = await self._locked_account(user_id)
        eligible_credits = purchase.base_credits + purchase.product_bonus_credits
        first_bonus = await self._first_purchase_bonus(user_id, purchase, eligible_credits)
        total = eligible_credits + first_bonus
        self._apply_debt(account, total)
        self._add_purchase_ledger(user_id, purchase, total, first_bonus)
        self._mark_granted(purchase, order, total, first_bonus)
        await self.session.commit()
        return self._snapshot(purchase, account)

    async def _refund(self, purchase: CreditPurchase, order: PurchaseOrder) -> CreditPurchaseResult:
        if purchase.status == "refunded":
            return await self._result(purchase)
        account = await self._locked_account(purchase.user_id) if purchase.user_id else None
        chargeback = max(0, purchase.granted_credits - purchase.chargeback_credits)
        if account and chargeback:
            self._apply_chargeback(account, chargeback)
            self._add_chargeback_ledger(purchase, chargeback)
        purchase.chargeback_credits += chargeback
        purchase.status = "refunded"
        purchase.provider_status = order.status
        purchase.refunded_at = datetime.now(timezone.utc)
        purchase.provider_checked_at = datetime.now(timezone.utc)
        await self.session.commit()
        return self._snapshot(purchase, account)

    async def _not_payable(self, purchase: CreditPurchase, order: PurchaseOrder) -> CreditPurchaseResult:
        await self._save_not_payable(purchase, order)
        raise ConflictError("Purchase is not ready to grant")

    async def _save_not_payable(self, purchase: CreditPurchase, order: PurchaseOrder) -> None:
        purchase.provider_status = order.status
        purchase.failure_reason = order.reason
        purchase.status = "failed" if order.status in ("FAILED", "NOT_FOUND", "MINIAPP_MISMATCH") else "processing"
        purchase.provider_checked_at = datetime.now(timezone.utc)
        await self.session.commit()

    async def _review(self, purchase: CreditPurchase, order: PurchaseOrder, reason: str) -> CreditPurchaseResult:
        await self._save_review(purchase, order, reason)
        raise ConflictError("Purchase requires review")

    async def _save_review(self, purchase: CreditPurchase, order: PurchaseOrder, reason: str) -> None:
        purchase.status = "review"
        purchase.provider_status = order.status
        purchase.failure_reason = reason
        purchase.provider_checked_at = datetime.now(timezone.utc)
        await self.session.commit()

    async def _result(self, purchase: CreditPurchase) -> CreditPurchaseResult:
        account = await self._account(purchase.user_id) if purchase.user_id else None
        return self._snapshot(purchase, account)

    async def _locked_account(self, user_id: UUID) -> CreditAccount:
        await self.session.execute(insert(CreditAccount).values(user_id=user_id).on_conflict_do_nothing())
        result = await self.session.execute(select(CreditAccount).where(CreditAccount.user_id == user_id).with_for_update())
        return result.scalar_one()

    async def _account(self, user_id: UUID) -> CreditAccount | None:
        return (await self.session.execute(select(CreditAccount).where(CreditAccount.user_id == user_id))).scalar_one_or_none()

    async def _purchase_by_id(self, purchase_id: UUID) -> CreditPurchase | None:
        result = await self.session.execute(select(CreditPurchase).where(CreditPurchase.id == purchase_id).with_for_update())
        return result.scalar_one_or_none()

    async def _user_exists(self, user_id: UUID) -> bool:
        return (await self.session.execute(select(User.id).where(User.id == user_id))).scalar_one_or_none() is not None

    async def _first_purchase_bonus(self, user_id: UUID, purchase: CreditPurchase, eligible_credits: int) -> int:
        if await self._has_prior_grant(purchase):
            return 0
        credits = eligible_credits * FIRST_PURCHASE_BONUS_PERCENT // 100
        event = SANDBOX_FIRST_PURCHASE_EVENT if purchase.provider == "apps_in_toss_sandbox" else FIRST_PURCHASE_EVENT
        statement = insert(RewardGrant).values(user_id=user_id, event_code=event, credits=credits).on_conflict_do_nothing().returning(RewardGrant.id)
        return credits if (await self.session.execute(statement)).scalar_one_or_none() else 0

    async def _has_prior_grant(self, purchase: CreditPurchase) -> bool:
        statement = select(CreditPurchase.id).where(CreditPurchase.provider_subject_hash == purchase.provider_subject_hash, CreditPurchase.id != purchase.id, CreditPurchase.granted_credits > 0).limit(1)
        return (await self.session.execute(statement)).scalar_one_or_none() is not None

    def _validate_owner(self, purchase: CreditPurchase, user_id: UUID, sku: str) -> None:
        if purchase.user_id != user_id or purchase.sku != sku:
            raise BadRequestError("Purchase does not belong to this user or product")

    def _apply_debt(self, account: CreditAccount, amount: int) -> None:
        debt = int(account.debt_credits or 0)
        repaid = min(debt, amount)
        account.debt_credits = debt - repaid
        account.purchased_credits += amount - repaid

    def _apply_chargeback(self, account: CreditAccount, amount: int) -> None:
        recovered = min(account.purchased_credits, amount)
        account.purchased_credits -= recovered
        account.debt_credits = int(account.debt_credits or 0) + amount - recovered

    def _mark_granted(self, purchase: CreditPurchase, order: PurchaseOrder, total: int, first_bonus: int) -> None:
        purchase.status = "granted"
        purchase.provider_status = order.status
        purchase.first_purchase_bonus_credits = first_bonus
        purchase.granted_credits = total
        purchase.granted_at = datetime.now(timezone.utc)
        purchase.provider_checked_at = datetime.now(timezone.utc)

    def _add_purchase_ledger(self, user_id: UUID, purchase: CreditPurchase, total: int, first_bonus: int) -> None:
        metadata = {"provider": purchase.provider, "order_id": purchase.provider_order_id, "sku": purchase.sku, "base_credits": purchase.base_credits, "product_bonus_credits": purchase.product_bonus_credits, "first_purchase_bonus_credits": first_bonus}
        self.session.add(CreditLedgerEntry(user_id=user_id, entry_type="purchase", balance_type="purchased", amount=total, idempotency_key=self._ledger_key("purchase", purchase), entry_metadata=metadata))

    def _add_chargeback_ledger(self, purchase: CreditPurchase, amount: int) -> None:
        if not purchase.user_id:
            return
        metadata = {"provider": purchase.provider, "order_id": purchase.provider_order_id, "sku": purchase.sku}
        self.session.add(CreditLedgerEntry(user_id=purchase.user_id, entry_type="chargeback", balance_type="purchased", amount=-amount, idempotency_key=self._ledger_key("chargeback", purchase), entry_metadata=metadata))

    def _ledger_reference(self, order: PurchaseOrder) -> str:
        if order.provider == TOSS_PURCHASE_PROVIDER:
            return order.order_id
        digest = sha256(f"{order.provider}:{order.order_id}".encode()).hexdigest()
        return f"{order.provider}:{digest}"

    def _ledger_key(self, kind: str, purchase: CreditPurchase) -> str:
        reference = purchase.ledger_reference or purchase.provider_order_id
        return f"{kind}:{reference}"

    def _snapshot(self, purchase: CreditPurchase, account: CreditAccount | None) -> CreditPurchaseResult:
        purchased = account.purchased_credits if account else 0
        bonus = account.bonus_credits if account else 0
        debt = int(account.debt_credits or 0) if account else 0
        return CreditPurchaseResult(purchase.provider_order_id, purchase.status, purchase.granted_credits, purchased, bonus, debt)
