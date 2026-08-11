from __future__ import annotations

import secrets
from typing import Annotated, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import Settings, get_settings
from app.core.errors import ForbiddenError, NotFoundError
from app.db.session import get_db_session
from app.models import ContentReport, ReportStatus, User
from app.repositories.credit_purchases import CreditPurchaseRepository
from app.repositories.moderation import ModerationRepository
from app.schemas.credits import CreditAccountAuditItemResponse, CreditPurchaseAuditItemResponse, CreditPurchaseAuditResponse, CreditPurchaseOperationsAccount, CreditPurchaseOperationsDetail, CreditPurchaseOperationsLedger, CreditPurchaseOperationsQueueResponse, CreditPurchaseOperationsResponse
from app.schemas.moderation import BlockedUserResponse, ConsentResponse, ContentReportCreate, ContentReportResponse, ModerationDecision, ModerationQueueResponse, ModerationReportResponse


router = APIRouter(tags=["safety"])
ModerationKey = Annotated[str, Header(alias="X-Moderation-Key")]


@router.get("/safety/consent", response_model=ConsentResponse)
async def consent_status(user: User = Depends(get_current_user), settings: Settings = Depends(get_settings), session: AsyncSession = Depends(get_db_session)) -> ConsentResponse:
    accepted = await ModerationRepository(session).consent_status(user.id, settings.terms_version)
    return ConsentResponse(accepted=accepted, terms_version=settings.terms_version)


@router.put("/safety/consent", response_model=ConsentResponse)
async def accept_terms(user: User = Depends(get_current_user), settings: Settings = Depends(get_settings), session: AsyncSession = Depends(get_db_session)) -> ConsentResponse:
    await ModerationRepository(session).accept_terms(user.id, settings.terms_version)
    return ConsentResponse(accepted=True, terms_version=settings.terms_version)


@router.post("/safety/reports", response_model=ContentReportResponse, status_code=status.HTTP_201_CREATED)
async def report_content(payload: ContentReportCreate, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> ContentReportResponse:
    row = await ModerationRepository(session).create_report(user.id, payload)
    return ContentReportResponse.model_validate(row, from_attributes=True)


@router.get("/safety/blocks", response_model=BlockedUserResponse)
async def blocked_users(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> BlockedUserResponse:
    return BlockedUserResponse(user_ids=await ModerationRepository(session).blocked_ids(user.id))


@router.put("/safety/blocks/{blocked_id}", status_code=status.HTTP_204_NO_CONTENT)
async def block_user(blocked_id: UUID, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> Response:
    await ModerationRepository(session).block_user(user.id, blocked_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/safety/blocks/{blocked_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unblock_user(blocked_id: UUID, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> Response:
    await ModerationRepository(session).unblock_user(user.id, blocked_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/moderation/reports", response_model=ModerationQueueResponse)
async def moderation_queue(key: ModerationKey, report_status: Optional[ReportStatus] = Query(None, alias="status"), settings: Settings = Depends(get_settings), session: AsyncSession = Depends(get_db_session)) -> ModerationQueueResponse:
    _require_moderator(key, settings)
    rows = await ModerationRepository(session).reports(report_status)
    return ModerationQueueResponse(reports=[_report_response(row) for row in rows])


@router.patch("/moderation/reports/{report_id}", response_model=ModerationReportResponse)
async def moderate_report(report_id: UUID, payload: ModerationDecision, key: ModerationKey, settings: Settings = Depends(get_settings), session: AsyncSession = Depends(get_db_session)) -> ModerationReportResponse:
    _require_moderator(key, settings)
    row = await ModerationRepository(session).decide(report_id, payload, settings.moderation_actor)
    return _report_response(row)


@router.get("/moderation/credit-purchases/audit", response_model=CreditPurchaseAuditResponse)
async def credit_purchase_audit(key: ModerationKey, limit: int = Query(100, ge=1, le=200), settings: Settings = Depends(get_settings), session: AsyncSession = Depends(get_db_session)) -> CreditPurchaseAuditResponse:
    _require_moderator(key, settings)
    report = await CreditPurchaseRepository(session).audit(limit)
    purchases = [CreditPurchaseAuditItemResponse(purchase=CreditPurchaseOperationsDetail.model_validate(item.purchase), reasons=list(item.reasons)) for item in report.purchases]
    accounts = [CreditAccountAuditItemResponse.model_validate(item, from_attributes=True) for item in report.accounts]
    return CreditPurchaseAuditResponse(generated_at=report.generated_at, purchases=purchases, accounts=accounts, truncated=report.truncated)


@router.get("/moderation/credit-purchases/{order_id}", response_model=CreditPurchaseOperationsResponse)
async def credit_purchase_operations(order_id: str, key: ModerationKey, settings: Settings = Depends(get_settings), session: AsyncSession = Depends(get_db_session)) -> CreditPurchaseOperationsResponse:
    _require_moderator(key, settings)
    result = await CreditPurchaseRepository(session).operations(order_id)
    if not result:
        raise NotFoundError("Credit purchase not found")
    purchase, account, ledger = result
    return CreditPurchaseOperationsResponse(purchase=CreditPurchaseOperationsDetail.model_validate(purchase), account=CreditPurchaseOperationsAccount.model_validate(account) if account else None, ledger=[CreditPurchaseOperationsLedger.model_validate(item) for item in ledger])


@router.get("/moderation/credit-purchases", response_model=CreditPurchaseOperationsQueueResponse)
async def credit_purchase_operations_queue(key: ModerationKey, purchase_status: Optional[Literal["processing", "granted", "refunded", "failed", "review"]] = Query(None, alias="status"), limit: int = Query(100, ge=1, le=200), settings: Settings = Depends(get_settings), session: AsyncSession = Depends(get_db_session)) -> CreditPurchaseOperationsQueueResponse:
    _require_moderator(key, settings)
    purchases = await CreditPurchaseRepository(session).operations_queue(purchase_status, limit)
    return CreditPurchaseOperationsQueueResponse(purchases=[CreditPurchaseOperationsDetail.model_validate(item) for item in purchases])


def _require_moderator(key: str, settings: Settings) -> None:
    if not settings.moderation_api_key or not secrets.compare_digest(key, settings.moderation_api_key):
        raise ForbiddenError("Invalid moderation credentials")


def _report_response(row: ContentReport) -> ModerationReportResponse:
    return ModerationReportResponse.model_validate(row, from_attributes=True)
