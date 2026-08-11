from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import Settings, get_settings
from app.core.credit_policy import CREDIT_POLICY_VERSION, ENERGY_POLICY_VERSION, FLOW_POLICIES, FlowPolicy
from app.core.credit_products import CREDIT_PRODUCTS, FIRST_PURCHASE_BONUS_PERCENT, CreditProduct, credit_product_skus
from app.db.session import get_db_session
from app.models import User
from app.repositories.credit_purchases import CreditPurchaseRepository
from app.repositories.credits import CreditRepository
from app.schemas.credits import CreditBalanceResponse, CreditCatalogResponse, CreditFlowResponse, CreditOfferResponse, CreditPurchaseGrantRequest, CreditPurchaseGrantResponse, CreditUsageListResponse, CreditUsageResponse
from app.services.credit_purchases import CreditPurchaseService


router = APIRouter(prefix="/credits", tags=["credits"])


@router.get("", response_model=CreditBalanceResponse)
async def get_credits(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> CreditBalanceResponse:
    return CreditBalanceResponse(**await CreditRepository(session).snapshot(user.id))


@router.get("/catalog", response_model=CreditCatalogResponse)
async def get_credit_catalog(user: User = Depends(get_current_user), settings: Settings = Depends(get_settings)) -> CreditCatalogResponse:
    return CreditCatalogResponse(credit_policy_version=CREDIT_POLICY_VERSION, energy_policy_version=ENERGY_POLICY_VERSION, offers=_offers(settings), flows=_flows())


@router.get("/usage", response_model=CreditUsageListResponse)
async def get_credit_usage(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> CreditUsageListResponse:
    items = await CreditRepository(session).usages(user.id)
    return CreditUsageListResponse(items=[CreditUsageResponse(id=str(item.id), flow=item.flow, credits=item.credits, energy_percent=item.energy_percent, bonus_credits=item.bonus_credits, purchased_credits=item.purchased_credits, status=item.status, created_at=item.created_at) for item in items])


@router.post("/purchases/grant", response_model=CreditPurchaseGrantResponse)
async def grant_credit_purchase(payload: CreditPurchaseGrantRequest, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session), settings: Settings = Depends(get_settings)) -> CreditPurchaseGrantResponse:
    result = await CreditPurchaseService(settings, CreditPurchaseRepository(session)).grant(user, payload.order_id)
    return CreditPurchaseGrantResponse(order_id=result.order_id, status=result.status, granted_credits=result.granted_credits, purchased_credits=result.purchased_credits, bonus_credits=result.bonus_credits, debt_credits=result.debt_credits, total_credits=result.purchased_credits + result.bonus_credits)


def _offers(settings: Settings) -> list[CreditOfferResponse]:
    skus = credit_product_skus(settings)
    integrated = settings.toss_iap_enabled
    purchasable = integrated and settings.toss_iap_purchase_enabled
    return [_offer(product, skus[product.offer_id] if integrated else "", purchasable) for product in CREDIT_PRODUCTS]


def _offer(product: CreditProduct, sku: str, enabled: bool) -> CreditOfferResponse:
    total = product.total_credits
    return CreditOfferResponse(id=product.offer_id, sku=sku, price_krw=product.price_krw, base_credits=product.base_credits, product_bonus_credits=product.product_bonus_credits, first_purchase_bonus_percent=FIRST_PURCHASE_BONUS_PERCENT, total_credits=total, first_purchase_total_credits=total + product.first_purchase_bonus_credits, label=product.label, payment_available=enabled and bool(sku))


def _flows() -> list[CreditFlowResponse]:
    visible = ("direct_dm_basic", "direct_dm_context", "direct_dm_pro", "feed_post", "character_interaction")
    return [_flow(FLOW_POLICIES[code]) for code in visible]


def _flow(policy: FlowPolicy) -> CreditFlowResponse:
    return CreditFlowResponse(code=policy.code, label=policy.label, credits=policy.credits, energy_percent=policy.energy_percent, energy_eligible=policy.energy_allowed, bonus_eligible=policy.bonus_allowed)
