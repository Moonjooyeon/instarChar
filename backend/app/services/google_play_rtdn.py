from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from uuid import UUID

import jwt
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientConnectionError, PyJWKClientError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import BadRequestError, ServiceUnavailableError, UnauthorizedError
from app.repositories.credit_purchases import CreditPurchaseRepository
from app.repositories.google_play_accounts import GooglePlayAccountsRepository
from app.repositories.google_play_rtdn_events import GooglePlayRtdnEventsRepository
from app.services.google_play_purchases import GooglePlayRtdnPurchaseService


GOOGLE_PUSH_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}
GOOGLE_PUSH_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
ONE_TIME_PURCHASED = 1
ONE_TIME_CANCELED = 2
VOIDED_ONE_TIME_PRODUCT = 2


@dataclass(frozen=True)
class GooglePlayRtdn:
    notification_type: str
    purchase_token: str


class GooglePlayRtdnVerifier:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def verify(self, authorization: str) -> None:
        token = self._bearer_token(authorization)
        claims = self._claims(token)
        if claims.get("email") != self.settings.google_play_rtdn_push_service_account_email:
            raise UnauthorizedError("Google Play RTDN sender is not authorized")
        if claims.get("email_verified") is not True:
            raise UnauthorizedError("Google Play RTDN sender is not verified")

    def _bearer_token(self, authorization: str) -> str:
        prefix, _, token = authorization.partition(" ")
        if prefix.lower() != "bearer" or not token:
            raise UnauthorizedError("Google Play RTDN authorization is required")
        return token

    def _claims(self, token: str) -> dict[str, object]:
        try:
            key = PyJWKClient(GOOGLE_PUSH_JWKS_URL).get_signing_key_from_jwt(token)
            claims = jwt.decode(token, key.key, algorithms=["RS256"], audience=self.settings.google_play_rtdn_audience, leeway=self.settings.oauth_jwt_leeway_seconds, options={"require": ["iss", "aud", "exp", "iat", "email", "email_verified"], "verify_iss": False})
        except PyJWKClientConnectionError as exc:
            raise ServiceUnavailableError("Google Play RTDN verification is unavailable") from exc
        except (jwt.PyJWTError, PyJWKClientError) as exc:
            raise UnauthorizedError("Google Play RTDN verification failed") from exc
        if not isinstance(claims, dict) or claims.get("iss") not in GOOGLE_PUSH_ISSUERS:
            raise UnauthorizedError("Google Play RTDN verification failed")
        return {str(key): value for key, value in claims.items()}


class GooglePlayRtdnService:
    def __init__(self, settings: Settings, session: AsyncSession) -> None:
        self.settings = settings
        self.events = GooglePlayRtdnEventsRepository(session)
        self.accounts = GooglePlayAccountsRepository(session)
        self.purchase_repository = CreditPurchaseRepository(session)
        self.purchases: GooglePlayRtdnPurchaseService | None = None
        self.verifier = GooglePlayRtdnVerifier(settings)

    async def process(self, authorization: str, message_id: str, encoded_data: str) -> None:
        self._ensure_enabled()
        self.verifier.verify(authorization)
        notification = decode_google_play_rtdn(encoded_data, self.settings.google_play_iap_package_name)
        event_id = await self.events.claim(message_id, notification.notification_type, notification.purchase_token)
        if not event_id:
            return
        await self._process_event(event_id, notification)

    async def _process_event(self, event_id: UUID, notification: GooglePlayRtdn) -> None:
        try:
            status = await self._apply(notification)
        except Exception as exc:
            await self.events.fail(event_id, type(exc).__name__)
            raise
        await self.events.complete(event_id, status)

    async def _apply(self, notification: GooglePlayRtdn) -> str:
        purchases = self._purchases()
        if notification.notification_type in {"one_time_purchased", "one_time_canceled"}:
            return await purchases.process_purchase(notification.purchase_token)
        if notification.notification_type == "voided":
            return await purchases.process_refund(notification.purchase_token)
        return "ignored"

    def _purchases(self) -> GooglePlayRtdnPurchaseService:
        if self.purchases is None:
            self.purchases = GooglePlayRtdnPurchaseService(self.settings, self.purchase_repository, self.accounts)
        return self.purchases

    def _ensure_enabled(self) -> None:
        if not self.settings.google_play_iap_enabled or not self.settings.google_play_rtdn_enabled:
            raise ServiceUnavailableError("Google Play RTDN is not available")


def decode_google_play_rtdn(encoded_data: str, package_name: str) -> GooglePlayRtdn:
    try:
        payload = json.loads(base64.b64decode(encoded_data, validate=True))
    except (ValueError, json.JSONDecodeError) as exc:
        raise BadRequestError("Google Play RTDN payload is invalid") from exc
    if not isinstance(payload, dict) or payload.get("packageName") != package_name:
        raise BadRequestError("Google Play RTDN package is invalid")
    return _notification(payload)


def _notification(payload: dict[object, object]) -> GooglePlayRtdn:
    one_time = payload.get("oneTimeProductNotification")
    if isinstance(one_time, dict):
        return _one_time_notification(one_time)
    voided = payload.get("voidedPurchaseNotification")
    if isinstance(voided, dict) and voided.get("productType") == VOIDED_ONE_TIME_PRODUCT:
        return GooglePlayRtdn("voided", _string(voided, "purchaseToken"))
    return GooglePlayRtdn("ignored", "")


def _one_time_notification(payload: dict[object, object]) -> GooglePlayRtdn:
    notification_type = payload.get("notificationType")
    if notification_type == ONE_TIME_PURCHASED:
        return GooglePlayRtdn("one_time_purchased", _string(payload, "purchaseToken"))
    if notification_type == ONE_TIME_CANCELED:
        return GooglePlayRtdn("one_time_canceled", _string(payload, "purchaseToken"))
    return GooglePlayRtdn("ignored", "")


def _string(payload: dict[object, object], key: str) -> str:
    value = payload.get(key)
    if isinstance(value, str) and value and len(value) <= 512:
        return value
    raise BadRequestError("Google Play RTDN payload is invalid")
