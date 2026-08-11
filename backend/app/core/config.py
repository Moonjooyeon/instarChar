from functools import lru_cache
import re
from typing import Literal

from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    app_name: str = "alive"
    database_url: str = "postgresql+asyncpg://instarchat:instarchat@localhost:7555/instarchat"
    frontend_origins: str = "http://localhost:5173"
    frontend_redirect_url: str = "http://localhost:5173"
    auth_cookie_name: str = "alive_session"
    auth_cookie_secure: bool = False
    auth_cookie_samesite: Literal["lax", "none", "strict"] = "lax"
    auth_secret_key: str = "change-me-in-env"
    auth_session_ttl_seconds: int = 60 * 60 * 24 * 30
    account_deletion_grace_days: int = 7
    account_deletion_identity_retention_days: int = 365
    account_deletion_scheduler_enabled: bool = True
    account_deletion_poll_seconds: int = 3600
    account_deletion_batch_size: int = 20
    native_oauth_redirect_url: str = "com.ashwoodfriends.alive://oauth/callback"
    native_oauth_code_ttl_seconds: int = 120
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/auth/google/callback"
    oauth_jwt_leeway_seconds: int = 60
    apple_client_id: str = ""
    apple_client_secret: str = ""
    apple_redirect_uri: str = "http://localhost:8000/api/auth/apple/callback"
    apple_native_client_id: str = "com.ashwoodfriends.alive"
    apple_native_client_secret: str = ""
    apple_team_id: str = ""
    apple_key_id: str = ""
    apple_private_key: str = ""
    oauth_token_encryption_key: str = ""
    apple_notification_audiences: str = ""
    toss_api_base_url: str = "https://apps-in-toss-api.toss.im"
    toss_app_name: str = "ashwoodfriends-alive"
    toss_mtls_cert_path: str = "/run/secrets/toss/toss-mtls-cert.pem"
    toss_mtls_key_path: str = "/run/secrets/toss/toss-mtls-key.pem"
    toss_iap_enabled: bool = False
    toss_iap_purchase_enabled: bool = False
    toss_iap_credit_5000_sku: str = ""
    toss_iap_credit_10000_sku: str = ""
    toss_iap_credit_30000_sku: str = ""
    toss_iap_credit_50000_sku: str = ""
    toss_iap_credit_100000_sku: str = ""
    toss_iap_reconciliation_enabled: bool = False
    toss_iap_reconciliation_poll_seconds: int = 3600
    toss_iap_reconciliation_batch_size: int = 50
    monogpt_gemini_api_key: str = ""
    monogpt_gemini_base_url: str = "https://monogpt.kr/api/monorouter/v1/gemini"
    monogpt_gemini_model_fast: str = "gemini-2.5-flash"
    monogpt_gemini_model_good: str = "gemini-2.5-pro"
    moderation_api_key: str = ""
    moderation_actor: str = "operations"
    terms_version: str = "2026-07-24"
    api_daily_limit: int = 50
    api_paid_daily_limit: int = 200
    feed_requests_per_minute: int = 60
    api_monthly_cost_limit_usd: float = 50.0
    api_estimated_call_cost_usd: float = 0.003
    monogpt_gemini_timeout_ms: int = 60000
    auto_post_scheduler_enabled: bool = True
    auto_post_poll_seconds: int = 30
    auto_post_batch_size: int = 10
    auto_post_default_interval_seconds: int = 3600
    s3_bucket: str = ""
    s3_region: str = ""
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_prefix: str = "alive"
    s3_presign_expires_seconds: int = 600
    media_max_upload_bytes: int = 10 * 1024 * 1024
    media_max_image_pixels: int = 40_000_000

    @computed_field
    @property
    def allowed_origins(self) -> list[str]:
        return [item.strip() for item in self.frontend_origins.split(",") if item.strip()]

    @computed_field
    @property
    def allowed_apple_notification_audiences(self) -> list[str]:
        configured = [item.strip() for item in self.apple_notification_audiences.split(",") if item.strip()]
        return configured or [item for item in (self.apple_client_id, self.apple_native_client_id) if item]

    @computed_field
    @property
    def toss_origin_regex(self) -> str:
        return rf"^https://{re.escape(self.toss_app_name)}\.(?:private-)?apps\.tossmini\.com$"


@lru_cache
def get_settings() -> Settings:
    return Settings()
