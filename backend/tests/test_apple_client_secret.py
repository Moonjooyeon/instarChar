from datetime import datetime, timezone

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from pytest import raises

from app.core.config import Settings
from app.core.errors import BadRequestError
from app.services.apple_client_secret import APPLE_TOKEN_AUDIENCE, AppleClientSecretFactory


def test_factory_generates_apple_client_secret_for_requested_client() -> None:
    private_key = ec.generate_private_key(ec.SECP256R1())
    pem = private_key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()).decode()
    settings = Settings(apple_team_id="TEAM123", apple_key_id="KEY123", apple_private_key=pem.replace("\n", "\\n"))
    def fixed_clock() -> datetime:
        return datetime(2026, 7, 28, 3, 0, tzinfo=timezone.utc)
    token = AppleClientSecretFactory(settings, fixed_clock).create("com.ashwoodfriends.alive")
    claims = jwt.decode(token, private_key.public_key(), algorithms=["ES256"], audience=APPLE_TOKEN_AUDIENCE, options={"verify_exp": False})
    assert jwt.get_unverified_header(token)["kid"] == "KEY123"
    assert claims["iss"] == "TEAM123"
    assert claims["sub"] == "com.ashwoodfriends.alive"
    assert claims["exp"] - claims["iat"] == 600


def test_factory_uses_static_secret_during_migration() -> None:
    token = AppleClientSecretFactory(Settings()).create("apple-client", "static-secret")
    assert token == "static-secret"


def test_factory_rejects_missing_signing_credentials() -> None:
    factory = AppleClientSecretFactory(Settings())
    with raises(BadRequestError, match="Apple client credentials are not configured"):
        factory.create("apple-client")
