from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from uuid import UUID

JsonMap = dict[str, object]


@dataclass(frozen=True)
class SessionPayload:
    user_id: UUID
    expires_at: int


def _encode_bytes(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _decode_bytes(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}")


def _signature(payload: str, secret_key: str) -> str:
    digest = hmac.new(secret_key.encode(), payload.encode(), hashlib.sha256).digest()
    return _encode_bytes(digest)


def sign_session(user_id: UUID, ttl_seconds: int, secret_key: str) -> str:
    expires_at = int(time.time()) + ttl_seconds
    payload = {"sub": str(user_id), "exp": expires_at}
    encoded = _encode_bytes(json.dumps(payload, separators=(",", ":")).encode())
    return f"{encoded}.{_signature(encoded, secret_key)}"


def verify_session(token: str, secret_key: str) -> SessionPayload | None:
    parts = token.split(".")
    if len(parts) != 2:
        return None
    if not hmac.compare_digest(parts[1], _signature(parts[0], secret_key)):
        return None
    return _payload_from_token(parts[0])


def _payload_from_token(encoded: str) -> SessionPayload | None:
    raw = json.loads(_decode_bytes(encoded))
    if not isinstance(raw, dict):
        return None
    expires_at = int(raw.get("exp", 0))
    if expires_at < int(time.time()):
        return None
    return SessionPayload(user_id=UUID(str(raw.get("sub"))), expires_at=expires_at)


def sign_oauth_state(provider: str, ttl_seconds: int, secret_key: str) -> str:
    expires_at = int(time.time()) + ttl_seconds
    payload = {"provider": provider, "exp": expires_at}
    encoded = _encode_bytes(json.dumps(payload, separators=(",", ":")).encode())
    return f"{encoded}.{_signature(encoded, secret_key)}"


def verify_oauth_state(token: str, provider: str, secret_key: str) -> bool:
    parts = token.split(".")
    if len(parts) != 2:
        return False
    if not hmac.compare_digest(parts[1], _signature(parts[0], secret_key)):
        return False
    return _state_matches_provider(parts[0], provider)


def _state_matches_provider(encoded: str, provider: str) -> bool:
    raw = json.loads(_decode_bytes(encoded))
    if not isinstance(raw, dict):
        return False
    expires_at = int(raw.get("exp", 0))
    return raw.get("provider") == provider and expires_at >= int(time.time())
