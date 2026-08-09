from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.credit_policy import CREDIT_POLICY_VERSION, ENERGY_POLICY_VERSION, FLOW_POLICIES, FlowPolicy
from app.db.session import get_db_session
from app.models import User
from app.repositories.credits import CreditRepository
from app.schemas.credits import CreditBalanceResponse, CreditCatalogResponse, CreditFlowResponse, CreditOfferResponse, CreditUsageListResponse, CreditUsageResponse


router = APIRouter(prefix="/credits", tags=["credits"])


@router.get("", response_model=CreditBalanceResponse)
async def get_credits(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> CreditBalanceResponse:
    return CreditBalanceResponse(**await CreditRepository(session).snapshot(user.id))


@router.get("/catalog", response_model=CreditCatalogResponse)
async def get_credit_catalog(user: User = Depends(get_current_user)) -> CreditCatalogResponse:
    return CreditCatalogResponse(credit_policy_version=CREDIT_POLICY_VERSION, energy_policy_version=ENERGY_POLICY_VERSION, offers=_offers(), flows=_flows())


@router.get("/usage", response_model=CreditUsageListResponse)
async def get_credit_usage(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> CreditUsageListResponse:
    items = await CreditRepository(session).usages(user.id)
    return CreditUsageListResponse(items=[CreditUsageResponse(id=str(item.id), flow=item.flow, credits=item.credits, energy_percent=item.energy_percent, bonus_credits=item.bonus_credits, purchased_credits=item.purchased_credits, status=item.status, created_at=item.created_at) for item in items])


def _offers() -> list[CreditOfferResponse]:
    return [_offer("credit-5000", 5000, 500, 0, "가볍게 이어가기"), _offer("credit-10000", 10000, 1000, 0, "꾸준히 이어가기"), _offer("credit-30000", 30000, 3000, 150, "가장 많이 선택해요"), _offer("credit-50000", 50000, 5000, 500, "오래 즐기기"), _offer("credit-100000", 100000, 10000, 1500, "깊게 이어가기")]


def _offer(offer_id: str, price: int, base: int, bonus: int, label: str) -> CreditOfferResponse:
    total = base + bonus
    return CreditOfferResponse(id=offer_id, price_krw=price, base_credits=base, product_bonus_credits=bonus, first_purchase_bonus_percent=10, total_credits=total, first_purchase_total_credits=total + total // 10, label=label)


def _flows() -> list[CreditFlowResponse]:
    visible = ("direct_dm_basic", "direct_dm_context", "direct_dm_flash_long", "direct_dm_pro", "direct_dm_pro_story", "feed_post", "image_understanding", "character_interaction")
    return [_flow(FLOW_POLICIES[code]) for code in visible]


def _flow(policy: FlowPolicy) -> CreditFlowResponse:
    return CreditFlowResponse(code=policy.code, label=policy.label, credits=policy.credits, energy_percent=policy.energy_percent, energy_eligible=policy.energy_allowed, bonus_eligible=policy.bonus_allowed)
