from __future__ import annotations

from typing import Protocol


class PurchaseOrder(Protocol):
    order_id: str
    sku: str
    status: str
    reason: str
    provider: str
