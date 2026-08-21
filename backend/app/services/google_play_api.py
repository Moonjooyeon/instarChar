from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from time import time
from typing import Literal
from urllib.parse import quote

import httpx
import jwt

from app.core.config import Settings
from app.core.errors import BadRequestError, ServiceUnavailableError


GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_PUBLISHER_BASE_URL = "https://androidpublisher.googleapis.com/androidpublisher/v3"
GOOGLE_PLAY_SCOPE = "https://www.googleapis.com/auth/androidpublisher"
GooglePlayPurchaseState = Literal["PURCHASED", "PENDING", "CANCELLED"]


@dataclass(frozen=True)
class GooglePlayPurchase:
    purchase_token: str
    product_id: str
    state: GooglePlayPurchaseState
    obfuscated_account_id: str


class GooglePlayApiClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.credentials = _service_account_credentials(settings.google_play_iap_service_account_json_path)

    async def get_purchase(self, purchase_token: str) -> GooglePlayPurchase:
        path = f"/applications/{quote(self.settings.google_play_iap_package_name, safe='')}/purchases/productsv2/tokens/{quote(purchase_token, safe='')}"
        response = await self._request("GET", path)
        return google_play_purchase(response, purchase_token)

    async def consume(self, product_id: str, purchase_token: str) -> None:
        package_name = quote(self.settings.google_play_iap_package_name, safe="")
        path = f"/applications/{package_name}/purchases/products/{quote(product_id, safe='')}/tokens/{quote(purchase_token, safe='')}:consume"
        await self._request("POST", path, allow_empty=True)

    async def _request(self, method: str, path: str, allow_empty: bool = False) -> dict[str, object]:
        token = await self._access_token()
        headers = {"Authorization": f"Bearer {token}"}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.request(method, f"{GOOGLE_PUBLISHER_BASE_URL}{path}", headers=headers)
        except httpx.HTTPError as exc:
            raise ServiceUnavailableError("Google Play verification is unavailable") from exc
        return _publisher_response(response, allow_empty)

    async def _access_token(self) -> str:
        assertion = self._service_account_assertion()
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(GOOGLE_OAUTH_TOKEN_URL, data={"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": assertion})
        except httpx.HTTPError as exc:
            raise ServiceUnavailableError("Google Play verification is unavailable") from exc
        payload = _oauth_response(response)
        token = payload.get("access_token")
        if isinstance(token, str) and token:
            return token
        raise ServiceUnavailableError("Google Play credentials are invalid")

    def _service_account_assertion(self) -> str:
        issued_at = int(time())
        payload = {"iss": self.credentials["client_email"], "scope": GOOGLE_PLAY_SCOPE, "aud": GOOGLE_OAUTH_TOKEN_URL, "iat": issued_at, "exp": issued_at + 3600}
        headers = {"kid": self.credentials["private_key_id"]}
        return jwt.encode(payload, self.credentials["private_key"], algorithm="RS256", headers=headers)


def google_play_purchase(payload: dict[str, object], purchase_token: str) -> GooglePlayPurchase:
    product_id = _product_id(payload)
    state = _purchase_state(payload)
    account_id = _string(payload, "obfuscatedExternalAccountId")
    return GooglePlayPurchase(purchase_token, product_id, state, account_id)


def _service_account_credentials(path: str) -> dict[str, str]:
    try:
        data = json.loads(Path(path).read_text())
    except (OSError, json.JSONDecodeError) as exc:
        raise ServiceUnavailableError("Google Play service account credentials are invalid") from exc
    if not isinstance(data, dict):
        raise ServiceUnavailableError("Google Play service account credentials are invalid")
    return {key: _credential_value(data, key) for key in ("client_email", "private_key", "private_key_id")}


def _credential_value(credentials: dict[object, object], key: str) -> str:
    value = credentials.get(key)
    if isinstance(value, str) and value:
        return value
    raise ServiceUnavailableError("Google Play service account credentials are invalid")


def _publisher_response(response: httpx.Response, allow_empty: bool = False) -> dict[str, object]:
    if response.is_success:
        if allow_empty and not response.content:
            return {}
        return _json_object(response)
    if response.status_code in (400, 404):
        raise BadRequestError("Google Play purchase is invalid")
    raise ServiceUnavailableError("Google Play verification is unavailable")


def _oauth_response(response: httpx.Response) -> dict[str, object]:
    if not response.is_success:
        raise ServiceUnavailableError("Google Play credentials are invalid")
    return _json_object(response)


def _json_object(response: httpx.Response) -> dict[str, object]:
    try:
        payload: object = response.json()
    except json.JSONDecodeError as exc:
        raise ServiceUnavailableError("Google Play response is invalid") from exc
    if isinstance(payload, dict):
        return {str(key): value for key, value in payload.items()}
    raise ServiceUnavailableError("Google Play response is invalid")


def _product_id(payload: dict[str, object]) -> str:
    lines = payload.get("productLineItem")
    if not isinstance(lines, list) or len(lines) != 1 or not isinstance(lines[0], dict):
        raise BadRequestError("Google Play purchase product is invalid")
    return _string(lines[0], "productId")


def _purchase_state(payload: dict[str, object]) -> GooglePlayPurchaseState:
    context = payload.get("purchaseStateContext")
    if not isinstance(context, dict):
        raise BadRequestError("Google Play purchase state is invalid")
    state = _string(context, "purchaseState")
    if state in ("PURCHASED", "PENDING", "CANCELLED"):
        return state
    raise BadRequestError("Google Play purchase state is invalid")


def _string(payload: dict[object, object], key: str) -> str:
    value = payload.get(key)
    if isinstance(value, str) and value:
        return value
    raise BadRequestError("Google Play purchase response is invalid")
