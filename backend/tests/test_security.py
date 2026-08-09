import base64
import json
import time
from uuid import uuid4

from app.core.security import _signature, read_oauth_state, sign_oauth_state, sign_session, verify_oauth_state, verify_session


def test_signed_session_round_trips() -> None:
    user_id = uuid4()
    token = sign_session(user_id, 60, "secret")
    payload = verify_session(token, "secret")
    assert payload is not None
    assert payload.user_id == user_id
    assert payload.session_version == 0


def test_signed_session_preserves_session_version() -> None:
    token = sign_session(uuid4(), 60, "secret", 4)
    payload = verify_session(token, "secret")
    assert payload is not None
    assert payload.session_version == 4


def test_signed_session_rejects_wrong_secret() -> None:
    token = sign_session(uuid4(), 60, "secret")
    assert verify_session(token, "other") is None


def test_signed_session_rejects_malformed_payload() -> None:
    token = f"not-json.{_signature('not-json', 'secret')}"
    assert verify_session(token, "secret") is None


def test_signed_session_rejects_non_uuid_subject() -> None:
    payload = {"sub": "not-a-uuid", "exp": int(time.time()) + 60}
    encoded = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()
    assert verify_session(f"{encoded}.{_signature(encoded, 'secret')}", "secret") is None


def test_signed_session_rejects_legacy_payload_without_session_version() -> None:
    payload = {"sub": str(uuid4()), "exp": int(time.time()) + 60}
    encoded = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()
    assert verify_session(f"{encoded}.{_signature(encoded, 'secret')}", "secret") is None


def test_oauth_state_matches_provider() -> None:
    token = sign_oauth_state("google", 60, "secret")
    assert verify_oauth_state(token, "google", "secret") is True


def test_oauth_state_preserves_redirect_urls() -> None:
    token = sign_oauth_state("google", 60, "secret", "http://192.168.0.2:5173/api/auth/google/callback", "http://192.168.0.2:5173")
    payload = read_oauth_state(token, "google", "secret")
    assert payload is not None
    assert payload.redirect_uri == "http://192.168.0.2:5173/api/auth/google/callback"
    assert payload.return_url == "http://192.168.0.2:5173"


def test_oauth_state_rejects_other_provider() -> None:
    token = sign_oauth_state("google", 60, "secret")
    assert verify_oauth_state(token, "apple", "secret") is False
