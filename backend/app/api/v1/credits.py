from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import Settings, get_settings
from app.core.credit_policy import CREDIT_POLICY_VERSION, ENERGY_POLICY_VERSION, FLOW_POLICIES, FlowPolicy
from app.core.credit_products import CREDIT_PRODUCTS, FIRST_PURCHASE_BONUS_PERCENT, CreditProduct, app_store_iap_purchase_available, app_store_product_ids, credit_product_skus, google_play_iap_purchase_available, google_play_product_ids, toss_iap_purchase_available
from app.db.session import get_db_session
from app.models import User
from app.repositories.credit_purchases import CreditPurchaseRepository
from app.repositories.credits import CreditRepository
from app.repositories.google_play_accounts import GooglePlayAccountsRepository
from app.schemas.credits import AppStoreCreditPurchaseGrantRequest, AppStoreNotificationRequest, AppStorePurchaseContextResponse, CreditBalanceResponse, CreditCatalogResponse, CreditFlowResponse, CreditOfferResponse, CreditPurchaseGrantRequest, CreditPurchaseGrantResponse, CreditPurchaseHistoryItemResponse, CreditPurchaseHistoryResponse, CreditUsageListResponse, CreditUsageResponse, GooglePlayCreditPurchaseGrantRequest, GooglePlayPurchaseContextResponse, GooglePlayRtdnRequest
from app.repositories.app_store_accounts import AppStoreAccountsRepository
from app.services.app_store_iap import AppStoreCreditPurchaseService
from app.services.app_store_notifications import AppStoreNotificationService
from app.services.credit_purchases import CreditPurchaseService
from app.services.google_play_purchases import GooglePlayCreditPurchaseService, google_play_account_id
from app.services.google_play_rtdn import GooglePlayRtdnService


router = APIRouter(prefix="/credits", tags=["credits"])


@router.get("", response_model=CreditBalanceResponse)
async def get_credits(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> CreditBalanceResponse:
    return CreditBalanceResponse(**await CreditRepository(session).snapshot(user.id))


@router.get("/catalog", response_model=CreditCatalogResponse)
async def get_credit_catalog(user: User = Depends(get_current_user), settings: Settings = Depends(get_settings)) -> CreditCatalogResponse:
    toss_available = toss_iap_purchase_available(settings, user.provider, user.provider_subject)
    google_play_available = google_play_iap_purchase_available(settings, str(user.id))
    app_store_available = app_store_iap_purchase_available(settings, str(user.id))
    return CreditCatalogResponse(credit_policy_version=CREDIT_POLICY_VERSION, energy_policy_version=ENERGY_POLICY_VERSION, offers=_offers(settings, toss_available, google_play_available, app_store_available), flows=_flows())


@router.get("/usage", response_model=CreditUsageListResponse)
async def get_credit_usage(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> CreditUsageListResponse:
    items = await CreditRepository(session).usages(user.id)
    return CreditUsageListResponse(items=[CreditUsageResponse(id=str(item.id), flow=item.flow, credits=item.credits, energy_percent=item.energy_percent, bonus_credits=item.bonus_credits, purchased_credits=item.purchased_credits, status=item.status, created_at=item.created_at) for item in items])


@router.post("/purchases/grant", response_model=CreditPurchaseGrantResponse)
async def grant_credit_purchase(payload: CreditPurchaseGrantRequest, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session), settings: Settings = Depends(get_settings)) -> CreditPurchaseGrantResponse:
    result = await CreditPurchaseService(settings, CreditPurchaseRepository(session)).grant(user, payload.order_id, payload.sku, payload.environment)
    return CreditPurchaseGrantResponse(order_id=result.order_id, status=result.status, granted_credits=result.granted_credits, purchased_credits=result.purchased_credits, bonus_credits=result.bonus_credits, debt_credits=result.debt_credits, total_credits=result.purchased_credits + result.bonus_credits)


@router.get("/purchases/google-play/context", response_model=GooglePlayPurchaseContextResponse)
async def get_google_play_purchase_context(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session), settings: Settings = Depends(get_settings)) -> GooglePlayPurchaseContextResponse:
    available = google_play_iap_purchase_available(settings, str(user.id))
    if not available:
        return GooglePlayPurchaseContextResponse(available=False)
    account_id = google_play_account_id(settings, user.id)
    await GooglePlayAccountsRepository(session).save(user.id, account_id)
    return GooglePlayPurchaseContextResponse(available=True, obfuscated_account_id=account_id)


@router.post("/purchases/google-play/grant", response_model=CreditPurchaseGrantResponse)
async def grant_google_play_credit_purchase(payload: GooglePlayCreditPurchaseGrantRequest, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session), settings: Settings = Depends(get_settings)) -> CreditPurchaseGrantResponse:
    await GooglePlayAccountsRepository(session).save(user.id, google_play_account_id(settings, user.id))
    result = await GooglePlayCreditPurchaseService(settings, CreditPurchaseRepository(session)).grant(user, payload.purchase_token)
    return CreditPurchaseGrantResponse(order_id=result.order_id, status=result.status, granted_credits=result.granted_credits, purchased_credits=result.purchased_credits, bonus_credits=result.bonus_credits, debt_credits=result.debt_credits, total_credits=result.purchased_credits + result.bonus_credits)


@router.get("/purchases/app-store/context", response_model=AppStorePurchaseContextResponse)
async def get_app_store_purchase_context(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session), settings: Settings = Depends(get_settings)) -> AppStorePurchaseContextResponse:
    token = await AppStoreCreditPurchaseService(settings, CreditPurchaseRepository(session), AppStoreAccountsRepository(session)).context(user)
    return AppStorePurchaseContextResponse(available=token is not None, app_account_token=str(token) if token else "")


@router.post("/purchases/app-store/grant", response_model=CreditPurchaseGrantResponse)
async def grant_app_store_credit_purchase(payload: AppStoreCreditPurchaseGrantRequest, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session), settings: Settings = Depends(get_settings)) -> CreditPurchaseGrantResponse:
    result = await AppStoreCreditPurchaseService(settings, CreditPurchaseRepository(session), AppStoreAccountsRepository(session)).grant(user, payload.signed_transaction)
    return CreditPurchaseGrantResponse(order_id=result.order_id, status=result.status, granted_credits=result.granted_credits, purchased_credits=result.purchased_credits, bonus_credits=result.bonus_credits, debt_credits=result.debt_credits, total_credits=result.purchased_credits + result.bonus_credits)


@router.post("/purchases/app-store/notifications", status_code=status.HTTP_204_NO_CONTENT)
async def app_store_notifications(payload: AppStoreNotificationRequest, session: AsyncSession = Depends(get_db_session), settings: Settings = Depends(get_settings)) -> None:
    await AppStoreNotificationService(settings, session).process(payload.signed_payload)


@router.post("/purchases/google-play/rtdn", status_code=status.HTTP_204_NO_CONTENT)
async def google_play_rtdn(payload: GooglePlayRtdnRequest, request: Request, session: AsyncSession = Depends(get_db_session), settings: Settings = Depends(get_settings)) -> None:
    await GooglePlayRtdnService(settings, session).process(request.headers.get("authorization", ""), payload.message.message_id, payload.message.data)


@router.get("/purchases", response_model=CreditPurchaseHistoryResponse)
async def get_credit_purchase_history(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> CreditPurchaseHistoryResponse:
    items = await CreditPurchaseRepository(session).history(user.id)
    return CreditPurchaseHistoryResponse(items=[CreditPurchaseHistoryItemResponse.model_validate(item) for item in items])


def _offers(settings: Settings, purchase_available: bool = False, google_play_purchase_available: bool = False, app_store_purchase_available: bool = False) -> list[CreditOfferResponse]:
    skus = credit_product_skus(settings)
    google_play_ids = google_play_product_ids(settings)
    app_store_ids = app_store_product_ids(settings)
    integrated = settings.toss_iap_enabled
    google_play_integrated = settings.google_play_iap_enabled
    app_store_integrated = settings.app_store_iap_enabled
    return [_offer(product, skus[product.offer_id] if integrated else "", purchase_available, google_play_ids[product.offer_id] if google_play_integrated else "", google_play_purchase_available, app_store_ids[product.offer_id] if app_store_integrated else "", app_store_purchase_available) for product in CREDIT_PRODUCTS]


def _offer(product: CreditProduct, sku: str, enabled: bool, google_play_product_id: str, google_play_enabled: bool, app_store_product_id: str, app_store_enabled: bool) -> CreditOfferResponse:
    total = product.total_credits
    return CreditOfferResponse(id=product.offer_id, sku=sku, google_play_product_id=google_play_product_id, app_store_product_id=app_store_product_id, price_krw=product.price_krw, base_credits=product.base_credits, product_bonus_credits=product.product_bonus_credits, first_purchase_bonus_percent=FIRST_PURCHASE_BONUS_PERCENT, total_credits=total, first_purchase_total_credits=total + product.first_purchase_bonus_credits, label=product.label, payment_available=enabled and bool(sku), google_play_payment_available=google_play_enabled and bool(google_play_product_id), app_store_payment_available=app_store_enabled and bool(app_store_product_id))


def _flows() -> list[CreditFlowResponse]:
    visible = ("direct_dm_basic", "direct_dm_context", "direct_dm_pro", "feed_post", "auto_feed_post", "character_analysis")
    return [_flow(FLOW_POLICIES[code]) for code in visible]


def _flow(policy: FlowPolicy) -> CreditFlowResponse:
    return CreditFlowResponse(code=policy.code, label=policy.label, credits=policy.credits, energy_percent=policy.energy_percent, energy_eligible=policy.energy_allowed, bonus_eligible=policy.bonus_allowed, hard_daily_limit=policy.hard_daily_limit, intro_free_uses=policy.intro_free_uses)
