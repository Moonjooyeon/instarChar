from cryptography.fernet import Fernet, InvalidToken

from app.core.config import Settings
from app.core.errors import ServiceUnavailableError


TOKEN_VERSION = "v1"


class TokenCipher:
    def __init__(self, settings: Settings) -> None:
        self.key = settings.oauth_token_encryption_key

    def encrypt(self, value: str) -> str:
        encrypted = self._fernet().encrypt(value.encode()).decode()
        return f"{TOKEN_VERSION}:{encrypted}"

    def decrypt(self, value: str) -> str:
        version, separator, encrypted = value.partition(":")
        if separator and version == TOKEN_VERSION:
            return self._decrypt(encrypted)
        raise ServiceUnavailableError("Stored OAuth token format is unsupported")

    def _decrypt(self, value: str) -> str:
        try:
            return self._fernet().decrypt(value.encode()).decode()
        except InvalidToken as exc:
            raise ServiceUnavailableError("Stored OAuth token cannot be decrypted") from exc

    def _fernet(self) -> Fernet:
        if not self.key:
            raise ServiceUnavailableError("OAuth token encryption is not configured")
        try:
            return Fernet(self.key.encode())
        except ValueError as exc:
            raise ServiceUnavailableError("OAuth token encryption is misconfigured") from exc
