from functools import lru_cache
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    resend_api_key: str | None = None
    notify_secret: str | None = None
    database_url: str
    clerk_secret_key: str
    clerk_jwt_key: str | None = None
    clerk_authorized_parties: Annotated[list[str], NoDecode] = []
    clerk_webhook_signing_secret: str | None = None
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000", "http://localhost:3001"]
    frontend_url: str = "http://localhost:3000"
    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None
    anthropic_api_key: str | None = None
    stripe_price_monthly: str = "price_1TpWY16zyw6RqhWJxmHWQWCs"
    stripe_price_annual: str = "price_1TpWY16zyw6RqhWJbW0plVaC"
    stripe_price_lifetime: str = "price_1TpWY26zyw6RqhWJ464D15Ag"
    stripe_price_trial: str = "price_1TpWY06zyw6RqhWJi4Lo16Dt"
    stripe_trial_id: str = "to_1TpXF56zyw6RqhWJZJQkIJw5"

    @field_validator("clerk_authorized_parties", "cors_origins", mode="before")
    @classmethod
    def _split_csv(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [p.strip() for p in v.split(",") if p.strip()]
        return v

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]