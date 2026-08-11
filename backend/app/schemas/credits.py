from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CreditOfferResponse(BaseModel):
    id: str
    sku: str = ""
    price_krw: int
    base_credits: int
    product_bonus_credits: int
    first_purchase_bonus_percent: int
    total_credits: int
    first_purchase_total_credits: int
    label: str
    payment_available: bool = False


class CreditFlowResponse(BaseModel):
    code: str
    label: str
    credits: int
    energy_percent: int
    energy_eligible: bool
    bonus_eligible: bool


class CreditCatalogResponse(BaseModel):
    credit_policy_version: str
    energy_policy_version: str
    offers: list[CreditOfferResponse]
    flows: list[CreditFlowResponse]


class CreditRewardMissionResponse(BaseModel):
    code: str
    credits: int
    completed: bool


class CreditBalanceResponse(BaseModel):
    purchased_credits: int
    bonus_credits: int
    debt_credits: int = 0
    total_credits: int
    energy_percent: int
    energy_max_percent: int
    next_energy_recovery_at: datetime | None
    credit_policy_version: str
    energy_policy_version: str
    reward_missions: list[CreditRewardMissionResponse] = Field(default_factory=list)


class CreditUsageResponse(BaseModel):
    id: str
    flow: str
    credits: int
    energy_percent: int
    bonus_credits: int
    purchased_credits: int
    status: str
    created_at: datetime


class CreditUsageListResponse(BaseModel):
    items: list[CreditUsageResponse] = Field(default_factory=list)


class CreditPurchaseGrantRequest(BaseModel):
    order_id: str = Field(min_length=1, max_length=80)


class CreditPurchaseGrantResponse(BaseModel):
    order_id: str
    status: str
    granted_credits: int
    purchased_credits: int
    bonus_credits: int
    debt_credits: int
    total_credits: int


class CreditPurchaseHistoryItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    provider_order_id: str
    sku: str
    status: Literal["processing", "granted", "refunded", "failed", "review"]
    base_credits: int
    product_bonus_credits: int
    first_purchase_bonus_credits: int
    granted_credits: int
    chargeback_credits: int
    created_at: datetime
    granted_at: datetime | None
    refunded_at: datetime | None


class CreditPurchaseHistoryResponse(BaseModel):
    items: list[CreditPurchaseHistoryItemResponse] = Field(default_factory=list)


class CreditPurchaseOperationsDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    provider_order_id: str
    user_id: UUID | None
    sku: str
    status: str
    provider_status: str
    price_krw: int
    base_credits: int
    product_bonus_credits: int
    first_purchase_bonus_credits: int
    granted_credits: int
    chargeback_credits: int
    failure_reason: str
    provider_checked_at: datetime | None
    granted_at: datetime | None
    refunded_at: datetime | None
    retention_until: datetime | None = None
    created_at: datetime | None = None


class CreditPurchaseOperationsAccount(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    purchased_credits: int
    bonus_credits: int
    debt_credits: int


class CreditPurchaseOperationsLedger(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    entry_type: str
    balance_type: str
    amount: int
    idempotency_key: str
    created_at: datetime


class CreditPurchaseOperationsResponse(BaseModel):
    purchase: CreditPurchaseOperationsDetail
    account: CreditPurchaseOperationsAccount | None
    ledger: list[CreditPurchaseOperationsLedger]


class CreditPurchaseOperationsQueueResponse(BaseModel):
    purchases: list[CreditPurchaseOperationsDetail]


class CreditPurchaseAuditItemResponse(BaseModel):
    purchase: CreditPurchaseOperationsDetail
    reasons: list[Literal["stale_processing", "status_review", "status_failed", "grant_amount_invalid", "purchase_ledger_mismatch", "refund_amount_mismatch", "chargeback_ledger_mismatch"]]


class CreditAccountAuditItemResponse(BaseModel):
    user_id: UUID
    purchased_credits: int
    bonus_credits: int
    debt_credits: int
    purchased_ledger_total: int
    bonus_ledger_total: int
    reasons: list[Literal["purchased_balance_mismatch", "bonus_balance_mismatch"]]


class CreditPurchaseAuditResponse(BaseModel):
    generated_at: datetime
    purchases: list[CreditPurchaseAuditItemResponse]
    accounts: list[CreditAccountAuditItemResponse]
    truncated: bool
