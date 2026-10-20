from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    database_url: str = "mysql+pymysql://oms:oms@localhost:3306/oms"
    cors_origins: str = "http://localhost:5180"
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""
    # Shared secret for the staff and admin endpoints (sent as X-Staff-Key). Empty = locked.
    staff_api_key: str = ""
    # A second staff key for automated browser checks, so it can be revoked on its own
    browser_check_key: str = ""
    # Demo extras: reset/clear sample data, simulated payments when Stripe has no keys
    demo_mode: bool = True
    # Order numbers restart each day in the restaurant's time zone
    restaurant_timezone: str = "Australia/Melbourne"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def stripe_enabled(self) -> bool:
        return bool(self.stripe_secret_key and self.stripe_publishable_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
