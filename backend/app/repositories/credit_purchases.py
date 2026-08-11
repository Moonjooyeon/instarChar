from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from sqlalchemy import or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select

from app.core.credit_products import FIRST_PURCHASE_BONUS_PERCENT, CreditProduct
from app.core.errors import BadRequestError, ConflictError
from app.models import CreditAccount, CreditLedgerEntry, CreditPurchase, RewardGrant, User
from app.services.toss_iap import TossIapOrder


FIRST_PURCHASE_EVENT = "first_purchase"


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


class CreditPurchaseRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def apply(self, user: User, subject_hash: str, order: TossIapOrder, product: CreditProduct) -> CreditPurchaseResult:
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
        keys = (f"purchase:{order_id}", f"chargeback:{order_id}")
        statement = select(CreditLedgerEntry).where(CreditLedgerEntry.idempotency_key.in_(keys)).order_by(CreditLedgerEntry.created_at)
        ledger = list((await self.session.execute(statement)).scalars().all())
        return purchase, account, ledger

    async def operations_queue(self, status: str | None, limit: int) -> list[CreditPurchase]:
        statement = select(CreditPurchase)
        if status:
            statement = statement.where(CreditPurchase.status == status)
        statement = statement.order_by(CreditPurchase.provider_checked_at.asc().nullsfirst(), CreditPurchase.created_at).limit(limit)
        return list((await self.session.execute(statement)).scalars().all())

    def due_statement(self, limit: int, now: datetime) -> Select[tuple[CreditPurchase]]:
        cutoff = now - timedelta(hours=6)
        due = or_(CreditPurchase.provider_checked_at.is_(None), CreditPurchase.provider_checked_at < cutoff)
        return select(CreditPurchase).where(CreditPurchase.status.in_(("processing", "granted")), due).order_by(CreditPurchase.provider_checked_at.asc().nullsfirst()).limit(limit).with_for_update(skip_locked=True)

    async def reconcile(self, purchase_id: UUID, order: TossIapOrder) -> None:
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

    async def _reconcile_processing(self, purchase: CreditPurchase, order: TossIapOrder) -> bool:
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

    async def _reserve(self, user_id: UUID, subject_hash: str, order: TossIapOrder, product: CreditProduct) -> CreditPurchase:
        purchase_id = uuid4()
        statement = insert(CreditPurchase).values(id=purchase_id, user_id=user_id, provider_order_id=order.order_id, provider_subject_hash=subject_hash, sku=order.sku, provider_status=order.status, price_krw=product.price_krw, base_credits=product.base_credits, product_bonus_credits=product.product_bonus_credits).on_conflict_do_nothing(index_elements=[CreditPurchase.provider_order_id]).returning(CreditPurchase.id)
        await self.session.execute(statement)
        result = await self.session.execute(select(CreditPurchase).where(CreditPurchase.provider_order_id == order.order_id).with_for_update())
        return result.scalar_one()

    async def _grant(self, purchase: CreditPurchase, user_id: UUID, order: TossIapOrder) -> CreditPurchaseResult:
        if not await self._user_exists(user_id):
            return await self._review(purchase, order, "Purchase user no longer exists")
        account = await self._locked_account(user_id)
        eligible_credits = purchase.base_credits + purchase.product_bonus_credits
        first_bonus = await self._first_purchase_bonus(user_id, eligible_credits)
        total = eligible_credits + first_bonus
        self._apply_debt(account, total)
        self._add_purchase_ledger(user_id, purchase, total, first_bonus)
        self._mark_granted(purchase, order, total, first_bonus)
        await self.session.commit()
        return self._snapshot(purchase, account)

    async def _refund(self, purchase: CreditPurchase, order: TossIapOrder) -> CreditPurchaseResult:
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

    async def _not_payable(self, purchase: CreditPurchase, order: TossIapOrder) -> CreditPurchaseResult:
        await self._save_not_payable(purchase, order)
        raise ConflictError("Purchase is not ready to grant")

    async def _save_not_payable(self, purchase: CreditPurchase, order: TossIapOrder) -> None:
        purchase.provider_status = order.status
        purchase.failure_reason = order.reason
        purchase.status = "failed" if order.status in ("FAILED", "NOT_FOUND", "MINIAPP_MISMATCH") else "processing"
        purchase.provider_checked_at = datetime.now(timezone.utc)
        await self.session.commit()

    async def _review(self, purchase: CreditPurchase, order: TossIapOrder, reason: str) -> CreditPurchaseResult:
        await self._save_review(purchase, order, reason)
        raise ConflictError("Purchase requires review")

    async def _save_review(self, purchase: CreditPurchase, order: TossIapOrder, reason: str) -> None:
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

    async def _first_purchase_bonus(self, user_id: UUID, eligible_credits: int) -> int:
        credits = eligible_credits * FIRST_PURCHASE_BONUS_PERCENT // 100
        statement = insert(RewardGrant).values(user_id=user_id, event_code=FIRST_PURCHASE_EVENT, credits=credits).on_conflict_do_nothing().returning(RewardGrant.id)
        return credits if (await self.session.execute(statement)).scalar_one_or_none() else 0

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

    def _mark_granted(self, purchase: CreditPurchase, order: TossIapOrder, total: int, first_bonus: int) -> None:
        purchase.status = "granted"
        purchase.provider_status = order.status
        purchase.first_purchase_bonus_credits = first_bonus
        purchase.granted_credits = total
        purchase.granted_at = datetime.now(timezone.utc)
        purchase.provider_checked_at = datetime.now(timezone.utc)

    def _add_purchase_ledger(self, user_id: UUID, purchase: CreditPurchase, total: int, first_bonus: int) -> None:
        metadata = {"provider": purchase.provider, "order_id": purchase.provider_order_id, "sku": purchase.sku, "base_credits": purchase.base_credits, "product_bonus_credits": purchase.product_bonus_credits, "first_purchase_bonus_credits": first_bonus}
        self.session.add(CreditLedgerEntry(user_id=user_id, entry_type="purchase", balance_type="purchased", amount=total, idempotency_key=f"purchase:{purchase.provider_order_id}", entry_metadata=metadata))

    def _add_chargeback_ledger(self, purchase: CreditPurchase, amount: int) -> None:
        if not purchase.user_id:
            return
        metadata = {"provider": purchase.provider, "order_id": purchase.provider_order_id, "sku": purchase.sku}
        self.session.add(CreditLedgerEntry(user_id=purchase.user_id, entry_type="chargeback", balance_type="purchased", amount=-amount, idempotency_key=f"chargeback:{purchase.provider_order_id}", entry_metadata=metadata))

    def _snapshot(self, purchase: CreditPurchase, account: CreditAccount | None) -> CreditPurchaseResult:
        purchased = account.purchased_credits if account else 0
        bonus = account.bonus_credits if account else 0
        debt = int(account.debt_credits or 0) if account else 0
        return CreditPurchaseResult(purchase.provider_order_id, purchase.status, purchase.granted_credits, purchased, bonus, debt)
