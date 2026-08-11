from __future__ import annotations

import asyncio
import os
from uuid import UUID, uuid4

import pytest
from sqlalchemy import delete, func, select

from app.core.credit_products import CREDIT_PRODUCTS
from app.db.session import AsyncSessionLocal
from app.models import CreditAccount, CreditLedgerEntry, CreditPurchase, RewardGrant, User, UserProvider
from app.repositories.credit_purchases import CreditPurchaseRepository, CreditPurchaseResult
from app.services.toss_iap import TossIapOrder


RUN_DATABASE_TESTS = os.getenv("RUN_DATABASE_INTEGRATION_TESTS") == "1"


@pytest.mark.skipif(not RUN_DATABASE_TESTS, reason="Set RUN_DATABASE_INTEGRATION_TESTS=1 to use the configured PostgreSQL database")
def test_purchase_database_invariants() -> None:
    asyncio.run(_verify_purchase_database_invariants())


async def _verify_purchase_database_invariants() -> None:
    await _verify_concurrent_purchase()
    await _verify_rejoined_subject_purchase()


async def _verify_concurrent_purchase() -> None:
    user_id = uuid4()
    order_id = f"integration-{uuid4()}"
    subject_hash = f"integration-{uuid4()}"
    await _prepare_user(user_id)
    try:
        results = await asyncio.gather(_grant_purchase(user_id, order_id, subject_hash), _grant_purchase(user_id, order_id, subject_hash))
        assert all(result.status == "granted" for result in results)
        await _assert_single_grant(user_id, order_id)
    finally:
        await _cleanup_purchase(user_id, order_id)


async def _verify_rejoined_subject_purchase() -> None:
    user_id = uuid4()
    order_id = f"integration-{uuid4()}"
    prior_order_id = f"integration-{uuid4()}"
    subject_hash = f"integration-{uuid4()}"
    await _prepare_user(user_id)
    await _prepare_prior_purchase(prior_order_id, subject_hash)
    try:
        result = await _grant_purchase(user_id, order_id, subject_hash)
        assert (result.granted_credits, result.purchased_credits) == (500, 500)
        await _assert_no_repeat_bonus(user_id, order_id)
    finally:
        await _cleanup_purchase(user_id, order_id, prior_order_id)


async def _prepare_user(user_id: UUID) -> None:
    async with AsyncSessionLocal() as session:
        subject = f"integration-{user_id}"
        session.add(User(id=user_id, email=f"{subject}@example.com", provider=UserProvider.toss, provider_subject=subject))
        await session.commit()


async def _grant_purchase(user_id: UUID, order_id: str, subject_hash: str) -> CreditPurchaseResult:
    async with AsyncSessionLocal() as session:
        user = await session.get(User, user_id)
        assert user is not None
        order = TossIapOrder(order_id, "integration-sku", "PAYMENT_COMPLETED", "2026-08-11T12:00:00", "")
        return await CreditPurchaseRepository(session).apply(user, subject_hash, order, CREDIT_PRODUCTS[0])


async def _prepare_prior_purchase(order_id: str, subject_hash: str) -> None:
    async with AsyncSessionLocal() as session:
        purchase = CreditPurchase(id=uuid4(), user_id=None, provider_order_id=order_id, provider_subject_hash=subject_hash, sku="integration-sku", status="refunded", provider_status="REFUNDED", price_krw=5000, base_credits=500, product_bonus_credits=0, first_purchase_bonus_credits=50, granted_credits=550, chargeback_credits=550, failure_reason="")
        session.add(purchase)
        await session.commit()


async def _assert_single_grant(user_id: UUID, order_id: str) -> None:
    async with AsyncSessionLocal() as session:
        purchase_count = await session.scalar(select(func.count()).select_from(CreditPurchase).where(CreditPurchase.provider_order_id == order_id))
        ledger_count = await session.scalar(select(func.count()).select_from(CreditLedgerEntry).where(CreditLedgerEntry.idempotency_key == f"purchase:{order_id}"))
        reward_count = await session.scalar(select(func.count()).select_from(RewardGrant).where(RewardGrant.user_id == user_id, RewardGrant.event_code == "first_purchase"))
        account = await session.get(CreditAccount, user_id)
        assert (purchase_count, ledger_count, reward_count) == (1, 1, 1)
        assert account is not None
        assert (account.purchased_credits, account.debt_credits) == (550, 0)


async def _assert_no_repeat_bonus(user_id: UUID, order_id: str) -> None:
    async with AsyncSessionLocal() as session:
        purchase = (await session.execute(select(CreditPurchase).where(CreditPurchase.provider_order_id == order_id))).scalar_one()
        reward_count = await session.scalar(select(func.count()).select_from(RewardGrant).where(RewardGrant.user_id == user_id, RewardGrant.event_code == "first_purchase"))
        assert purchase.first_purchase_bonus_credits == 0
        assert reward_count == 0


async def _cleanup_purchase(user_id: UUID, *order_ids: str) -> None:
    async with AsyncSessionLocal() as session:
        await session.execute(delete(CreditPurchase).where(CreditPurchase.provider_order_id.in_(order_ids)))
        await session.execute(delete(CreditLedgerEntry).where(CreditLedgerEntry.user_id == user_id))
        await session.execute(delete(RewardGrant).where(RewardGrant.user_id == user_id))
        await session.execute(delete(CreditAccount).where(CreditAccount.user_id == user_id))
        await session.execute(delete(User).where(User.id == user_id))
        await session.commit()
