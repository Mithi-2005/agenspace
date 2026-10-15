import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env", env_file_encoding="utf-8", extra="ignore"
    )
    app_name: str = "Kosway"
    ai_assistant_name: str = "Moon"
    brand_logo_url: str = "/brand/kosway-mark.svg"
    app_env: str = "development"
    api_v1_prefix: str = "/api/v1"
    secret_key: SecretStr = Field(default=SecretStr("local-development-only-change-me"))
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    cookie_secure: bool | None = None
    cookie_samesite: str = "lax"
    auth_rate_limit_enabled: bool = True
    auth_rate_limit_requests: int = 10
    auth_rate_limit_window_seconds: int = 60
    jwt_algorithm: str = "HS256"
    database_url: str
    cors_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    log_level: str = "INFO"

    @property
    def is_cookie_secure(self) -> bool:
        if self.cookie_secure is not None:
            return self.cookie_secure
        return self.app_env.lower() == "production"

    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, value: SecretStr, info: object) -> SecretStr:
        secret = value.get_secret_value()
        # In production, require at least 32 characters and reject known dev defaults
        if len(secret) < 16:
            raise ValueError("SECRET_KEY must be at least 16 characters long.")
        return value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        try:
            decoded = json.loads(value)
        except json.JSONDecodeError:
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return decoded


@lru_cache
def get_settings() -> Settings:
    return Settings()
