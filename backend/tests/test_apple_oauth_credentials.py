import asyncio
from datetime import datetime, timezone
from typing import cast
from uuid import uuid4

from cryptography.fernet import Fernet
from pytest import raises
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import ServiceUnavailableError
from app.core.token_encryption import TokenCipher
from app.repositories.apple_credentials import AppleCredentialsRepository


class StubSession:
    def __init__(self) -> None:
        self.statements: list[object] = []

    async def execute(self, statement: object) -> None:
        self.statements.append(statement)


def test_token_cipher_round_trip_does_not_expose_plaintext() -> None:
    key = Fernet.generate_key().decode()
    cipher = TokenCipher(Settings(oauth_token_encryption_key=key))
    encrypted = cipher.encrypt("apple-refresh-token")
    assert encrypted.startswith("v1:")
    assert "apple-refresh-token" not in encrypted
    assert cipher.decrypt(encrypted) == "apple-refresh-token"


def test_token_cipher_rejects_wrong_key() -> None:
    encrypted = TokenCipher(Settings(oauth_token_encryption_key=Fernet.generate_key().decode())).encrypt("token")
    cipher = TokenCipher(Settings(oauth_token_encryption_key=Fernet.generate_key().decode()))
    with raises(ServiceUnavailableError, match="cannot be decrypted"):
        cipher.decrypt(encrypted)


def test_credential_upsert_targets_user_and_client_unique_key() -> None:
    session = StubSession()
    repository = AppleCredentialsRepository(cast(AsyncSession, session))
    expires_at = datetime(2026, 7, 28, tzinfo=timezone.utc)
    asyncio.run(repository.upsert(uuid4(), "client-id", "subject", "encrypted-refresh", "encrypted-access", expires_at))
    compiled = cast(object, session.statements[0]).compile(dialect=postgresql.dialect())
    assert "ON CONFLICT (user_id, client_id) DO UPDATE" in str(compiled)
    assert compiled.params["refresh_token_encrypted"] == "encrypted-refresh"
