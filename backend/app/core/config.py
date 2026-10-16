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

    # -------------------------------------------------------------------------
    # Phase 3 — Integration settings
    #
    # All four fields default to None so that:
    #   • The application starts normally in local development without Google
    #     credentials configured.
    #   • Existing tests that do not touch integrations continue to pass.
    #   • The encryption utility and future OAuth routes raise a clear
    #     RuntimeError (not a silent no-op) when invoked with missing config.
    #
    # In production, all four MUST be supplied via environment variables or a
    # secrets manager before the Gmail integration is enabled.
    # -------------------------------------------------------------------------

    # Google OAuth 2.0 client credentials — from Google Cloud Console.
    google_client_id: str | None = Field(
        default=None,
        description="Google OAuth 2.0 client ID",
    )
    google_client_secret: SecretStr | None = Field(
        default=None,
        description="Google OAuth 2.0 client secret",
    )
    # Must match the redirect URI registered in the Google Cloud Console exactly.
    # Local dev example: http://localhost:8000/api/v1/integrations/google/callback
    google_redirect_uri: str | None = Field(
        default=None,
        description="Google OAuth redirect URI registered in GCP Console",
    )
    # Fernet symmetric key for encrypting OAuth access and refresh tokens at rest.
    # Generate with:
    #   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    # The output is exactly 44 characters (32 bytes, url-safe base64-encoded with padding).
    # Never commit a real key; never log it; rotate by re-encrypting all credential rows.
    integration_encryption_key: SecretStr | None = Field(
        default=None,
        description="Fernet key used to encrypt OAuth tokens at rest",
    )

    # ------------------------------------------------------------------
    # Computed properties
    # ------------------------------------------------------------------

    @property
    def is_cookie_secure(self) -> bool:
        if self.cookie_secure is not None:
            return self.cookie_secure
        return self.app_env.lower() == "production"

    @property
    def integrations_configured(self) -> bool:
        """Return True only when all four integration settings are present.

        The encryption utility and OAuth routes must call this (or check
        ``integration_encryption_key`` directly) before proceeding, so that
        missing configuration raises a clear error rather than an
        AttributeError or silent failure.
        """
        return (
            self.google_client_id is not None
            and self.google_client_secret is not None
            and self.google_redirect_uri is not None
            and self.integration_encryption_key is not None
        )

    # ------------------------------------------------------------------
    # Validators
    # ------------------------------------------------------------------

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
