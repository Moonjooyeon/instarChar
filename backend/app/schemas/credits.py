from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field


class CreditOfferResponse(BaseModel):
    id: str
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


class CreditBalanceResponse(BaseModel):
    purchased_credits: int
    bonus_credits: int
    total_credits: int
    energy_percent: int
    energy_max_percent: int
    next_energy_recovery_at: datetime | None
    credit_policy_version: str
    energy_policy_version: str


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
