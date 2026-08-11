from __future__ import annotations

import asyncio

import pytest

from app.core.errors import BadRequestError
from app.services.toss_iap import TOSS_ORDER_STATUS_PATH, TossIapService


class StubApi:
    def __init__(self, response: dict[str, object]) -> None:
        self.response = response
        self.calls: list[tuple[str, dict[str, object], dict[str, str]]] = []

    async def post(self, path: str, payload: dict[str, object], headers: dict[str, str]) -> dict[str, object]:
        self.calls.append((path, payload, headers))
        return self.response


def test_order_status_uses_mtls_api_contract_and_user_key() -> None:
    api = StubApi({"orderId": "order-1", "sku": "sku-1", "status": "PAYMENT_COMPLETED", "statusDeterminedAt": "2026-08-11T10:00:00", "reason": ""})
    order = asyncio.run(TossIapService(api).get_order("order-1", "123"))  # type: ignore[arg-type]
    assert (order.order_id, order.sku, order.status) == ("order-1", "sku-1", "PAYMENT_COMPLETED")
    assert api.calls == [(TOSS_ORDER_STATUS_PATH, {"orderId": "order-1"}, {"x-toss-user-key": "123"})]


def test_order_status_rejects_mismatched_order() -> None:
    api = StubApi({"orderId": "other", "sku": "sku-1", "status": "PURCHASED", "statusDeterminedAt": "", "reason": ""})
    with pytest.raises(BadRequestError):
        asyncio.run(TossIapService(api).get_order("order-1"))  # type: ignore[arg-type]
