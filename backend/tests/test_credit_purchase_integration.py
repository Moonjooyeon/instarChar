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
def test_concurrent_purchase_grants_exactly_once() -> None:
    asyncio.run(_verify_concurrent_purchase())


async def _verify_concurrent_purchase() -> None:
    user_id = uuid4()
    order_id = f"integration-{uuid4()}"
    await _prepare_user(user_id)
    try:
        results = await asyncio.gather(_grant_purchase(user_id, order_id), _grant_purchase(user_id, order_id))
        assert all(result.status == "granted" for result in results)
        await _assert_single_grant(user_id, order_id)
    finally:
        await _cleanup_purchase(user_id, order_id)


async def _prepare_user(user_id: UUID) -> None:
    async with AsyncSessionLocal() as session:
        subject = f"integration-{user_id}"
        session.add(User(id=user_id, email=f"{subject}@example.com", provider=UserProvider.toss, provider_subject=subject))
        await session.commit()


async def _grant_purchase(user_id: UUID, order_id: str) -> CreditPurchaseResult:
    async with AsyncSessionLocal() as session:
        user = await session.get(User, user_id)
        assert user is not None
        order = TossIapOrder(order_id, "integration-sku", "PAYMENT_COMPLETED", "2026-08-11T12:00:00", "")
        return await CreditPurchaseRepository(session).apply(user, "integration-subject-hash", order, CREDIT_PRODUCTS[0])


async def _assert_single_grant(user_id: UUID, order_id: str) -> None:
    async with AsyncSessionLocal() as session:
        purchase_count = await session.scalar(select(func.count()).select_from(CreditPurchase).where(CreditPurchase.provider_order_id == order_id))
        ledger_count = await session.scalar(select(func.count()).select_from(CreditLedgerEntry).where(CreditLedgerEntry.idempotency_key == f"purchase:{order_id}"))
        reward_count = await session.scalar(select(func.count()).select_from(RewardGrant).where(RewardGrant.user_id == user_id, RewardGrant.event_code == "first_purchase"))
        account = await session.get(CreditAccount, user_id)
        assert (purchase_count, ledger_count, reward_count) == (1, 1, 1)
        assert account is not None
        assert (account.purchased_credits, account.debt_credits) == (550, 0)


async def _cleanup_purchase(user_id: UUID, order_id: str) -> None:
    async with AsyncSessionLocal() as session:
        await session.execute(delete(CreditPurchase).where(CreditPurchase.provider_order_id == order_id))
        await session.execute(delete(CreditLedgerEntry).where(CreditLedgerEntry.user_id == user_id))
        await session.execute(delete(RewardGrant).where(RewardGrant.user_id == user_id))
        await session.execute(delete(CreditAccount).where(CreditAccount.user_id == user_id))
        await session.execute(delete(User).where(User.id == user_id))
        await session.commit()
