from functools import lru_cache
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    clerk_secret_key: str
    clerk_jwt_key: str | None = None
    clerk_authorized_parties: Annotated[list[str], NoDecode] = []
    clerk_webhook_signing_secret: str | None = None
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000", "http://localhost:3001"]
    stripe_secret_key: str
    stripe_webhook_secret: str
    stripe_price_monthly: str = "price_1ToUzX7vz5P4p4bDMYgT7Zwd"
    stripe_price_annual: str = "price_1ToUzX7vz5P4p4bDGrZnsnq4"
    stripe_price_lifetime: str = "price_1ToUzX7vz5P4p4bD0Lsi6unN"
    stripe_price_trial: str = "price_1ToVFl7vz5P4p4bDjwBz0PN0"
    stripe_trial_id: str = "to_1ToVGQ7vz5P4p4bDosyTKMVh"

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