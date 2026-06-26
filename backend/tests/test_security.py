from uuid import uuid4

from app.core.security import sign_oauth_state, sign_session, verify_oauth_state, verify_session


def test_signed_session_round_trips() -> None:
    user_id = uuid4()
    token = sign_session(user_id, 60, "secret")
    payload = verify_session(token, "secret")
    assert payload is not None
    assert payload.user_id == user_id


def test_signed_session_rejects_wrong_secret() -> None:
    token = sign_session(uuid4(), 60, "secret")
    assert verify_session(token, "other") is None


def test_oauth_state_matches_provider() -> None:
    token = sign_oauth_state("google", 60, "secret")
    assert verify_oauth_state(token, "google", "secret") is True


def test_oauth_state_rejects_other_provider() -> None:
    token = sign_oauth_state("google", 60, "secret")
    assert verify_oauth_state(token, "apple", "secret") is False
