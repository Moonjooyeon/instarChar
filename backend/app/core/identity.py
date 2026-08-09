import hmac
from hashlib import sha256

from app.core.config import Settings
from app.models import UserProvider


def account_identity_fingerprint(settings: Settings, provider: UserProvider, subject: str) -> str:
    secret = settings.auth_secret_key.encode()
    value = f"alive:account-deletion:{provider.value}:{subject}".encode()
    return hmac.new(secret, value, sha256).hexdigest()
