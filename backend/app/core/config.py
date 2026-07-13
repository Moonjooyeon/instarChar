from functools import lru_cache

from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    app_name: str = "alive"
    database_url: str = "postgresql+asyncpg://instarchat:instarchat@localhost:7555/instarchat"
    frontend_origins: str = "http://localhost:5173"
    auth_cookie_name: str = "alive_session"
    auth_cookie_secure: bool = False
    auth_secret_key: str = "change-me-in-env"
    auth_session_ttl_seconds: int = 60 * 60 * 24 * 30
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/auth/google/callback"
    apple_client_id: str = ""
    apple_client_secret: str = ""
    apple_redirect_uri: str = "http://localhost:8000/api/auth/apple/callback"
    gemini_api_key: str = ""
    gemini_model_fast: str = "gemini-2.5-flash"
    gemini_model_good: str = "gemini-2.5-pro"
    api_daily_limit: int = 50
    api_monthly_cost_limit_usd: float = 60.0
    api_estimated_call_cost_usd: float = 0.003
    gemini_timeout_ms: int = 45000

    @computed_field
    @property
    def allowed_origins(self) -> list[str]:
        return [item.strip() for item in self.frontend_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
