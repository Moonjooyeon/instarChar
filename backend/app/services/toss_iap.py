from __future__ import annotations

from dataclasses import dataclass

from app.core.errors import BadRequestError
from app.services.toss_api import TossApiClient


TOSS_ORDER_STATUS_PATH = "/api-partner/v1/apps-in-toss/order/get-order-status"
TOSS_ORDER_STATUSES = {"PURCHASED", "PAYMENT_COMPLETED", "FAILED", "REFUNDED", "ORDER_IN_PROGRESS", "NOT_FOUND", "MINIAPP_MISMATCH", "ERROR"}


@dataclass(frozen=True)
class TossIapOrder:
    order_id: str
    sku: str
    status: str
    status_determined_at: str
    reason: str


class TossIapService:
    def __init__(self, api: TossApiClient) -> None:
        self.api = api

    async def get_order(self, order_id: str, user_key: str = "") -> TossIapOrder:
        headers = {"x-toss-user-key": user_key} if user_key else {}
        response = await self.api.post(TOSS_ORDER_STATUS_PATH, {"orderId": order_id}, headers)
        return self._order(response, order_id)

    def _order(self, response: dict[str, object], requested_order_id: str) -> TossIapOrder:
        order_id = self._string(response, "orderId")
        sku = self._string(response, "sku", allow_empty=True)
        status = self._string(response, "status")
        if order_id != requested_order_id or status not in TOSS_ORDER_STATUSES:
            raise BadRequestError("Toss IAP order response is invalid")
        determined = self._string(response, "statusDeterminedAt", allow_empty=True)
        reason = self._string(response, "reason", allow_empty=True)
        return TossIapOrder(order_id, sku, status, determined, reason)

    def _string(self, response: dict[str, object], key: str, allow_empty: bool = False) -> str:
        value = response.get(key)
        if isinstance(value, str) and (value or allow_empty):
            return value
        raise BadRequestError("Toss IAP order response is invalid")
