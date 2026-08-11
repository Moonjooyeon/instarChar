from __future__ import annotations

import httpx

from app.core.config import Settings
from app.core.errors import BadRequestError, ServiceUnavailableError


class TossApiClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def get(self, path: str, headers: dict[str, str] | None = None) -> dict[str, object]:
        return await self._request("GET", path, None, headers or {})

    async def post(self, path: str, payload: dict[str, object], headers: dict[str, str] | None = None) -> dict[str, object]:
        return await self._request("POST", path, payload, headers or {})

    async def _request(self, method: str, path: str, payload: dict[str, object] | None, headers: dict[str, str]) -> dict[str, object]:
        try:
            async with self._client() as client:
                url = f"{self.settings.toss_api_base_url}{path}"
                if payload is None:
                    response = await client.request(method, url, headers=headers)
                else:
                    response = await client.request(method, url, json=payload, headers=headers)
        except httpx.HTTPError as exc:
            raise ServiceUnavailableError("Toss API is temporarily unavailable") from exc
        return self._success_payload(self._response_data(response))

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(timeout=10.0, cert=self._certificate())

    def _certificate(self) -> tuple[str, str]:
        certificate = self.settings.toss_mtls_cert_path
        private_key = self.settings.toss_mtls_key_path
        if certificate and private_key:
            return certificate, private_key
        raise BadRequestError("Toss mTLS certificate is not configured")

    def _response_data(self, response: httpx.Response) -> dict[str, object]:
        if response.status_code >= 500:
            raise ServiceUnavailableError("Toss API is temporarily unavailable")
        if response.status_code >= 400:
            raise BadRequestError("Toss API request failed")
        try:
            data: object = response.json()
        except ValueError as exc:
            raise BadRequestError("Toss API response is invalid") from exc
        if isinstance(data, dict) and all(isinstance(key, str) for key in data):
            return data
        raise BadRequestError("Toss API response is invalid")

    def _success_payload(self, response: dict[str, object]) -> dict[str, object]:
        success = response.get("success")
        if response.get("resultType") == "SUCCESS" and isinstance(success, dict):
            return {str(key): value for key, value in success.items()}
        raise BadRequestError("Toss API request failed")
