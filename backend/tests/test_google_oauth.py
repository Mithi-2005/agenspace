import uuid
from unittest.mock import patch

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import hash_password
from app.models.external_account import ExternalAccount, ExternalAccountStatus
from app.models.oauth_state import OAuthState
from app.models.user import User
from app.services.external_account_service import get_decrypted_tokens
from app.services.oauth_state_service import generate_oauth_state


@pytest.fixture(autouse=True)
def integration_settings(monkeypatch: pytest.MonkeyPatch) -> Settings:
    fernet_key = Fernet.generate_key().decode("utf-8")
    test_settings = Settings(
        GOOGLE_CLIENT_ID="mock-google-client-id",
        GOOGLE_CLIENT_SECRET=SecretStr("mock-google-client-secret"),
        GOOGLE_REDIRECT_URI="http://localhost:8000/api/v1/integrations/google/callback",
        INTEGRATION_ENCRYPTION_KEY=SecretStr(fernet_key),
    )
    monkeypatch.setattr("app.core.config.get_settings", lambda: test_settings)
    monkeypatch.setattr("app.integrations.google.client.get_settings", lambda: test_settings)
    monkeypatch.setattr("app.integrations.crypto.get_settings", lambda: test_settings)
    return test_settings


def _create_user_and_auth_headers(client: TestClient, db: Session, email_prefix: str = "oauth_api") -> tuple[User, dict]:
    unique_email = f"{email_prefix}_{uuid.uuid4().hex[:8]}@example.com"
    user = User(
        email=unique_email,
        display_name="OAuth User",
        password_hash=hash_password("Password123!"),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    res = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "Password123!"},
    )
    assert res.status_code == 200
    token = res.json()["access_token"]
    return user, {"Authorization": f"Bearer {token}"}


def test_google_authorize_requires_auth(client: TestClient) -> None:
    res = client.get("/api/v1/integrations/google/authorize")
    assert res.status_code == 401


def test_google_authorize_missing_config(client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    _, headers = _create_user_and_auth_headers(client, db_session, "missing_cfg")
    unconfigured_settings = Settings(
        GOOGLE_CLIENT_ID=None,
        GOOGLE_CLIENT_SECRET=None,
        GOOGLE_REDIRECT_URI=None,
        INTEGRATION_ENCRYPTION_KEY=None,
    )
    monkeypatch.setattr("app.integrations.google.client.get_settings", lambda: unconfigured_settings)

    res = client.get("/api/v1/integrations/google/authorize", headers=headers)
    assert res.status_code == 503
    assert "GOOGLE_CLIENT_ID is not configured" in res.json()["detail"]


def test_google_authorize_success(client: TestClient, db_session: Session) -> None:
    user, headers = _create_user_and_auth_headers(client, db_session, "authz_ok")

    res = client.get("/api/v1/integrations/google/authorize", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "authorization_url" in data
    auth_url = data["authorization_url"]

    assert "https://accounts.google.com/o/oauth2/v2/auth" in auth_url
    assert "client_id=mock-google-client-id" in auth_url
    assert "mail.google.com" in auth_url
    assert "include_granted_scopes=true" in auth_url
    assert "state=" in auth_url

    # Check OAuthState record was persisted in database
    states = list(db_session.scalars(select(OAuthState).where(OAuthState.user_id == user.id)).all())
    assert len(states) == 1
    assert states[0].provider == "google"
    assert states[0].is_used is False


def test_google_callback_with_error_redirects_safely(client: TestClient) -> None:
    res = client.get("/api/v1/integrations/google/callback?error=access_denied", follow_redirects=False)
    assert res.status_code == 307
    location = res.headers["location"]
    assert "/#/connections?status=error&detail=access_denied" in location
    assert "access_token" not in location


def test_google_callback_missing_params(client: TestClient) -> None:
    res = client.get("/api/v1/integrations/google/callback", follow_redirects=False)
    assert res.status_code == 307
    location = res.headers["location"]
    assert "/#/connections?status=error&detail=missing_parameters" in location


def test_google_callback_invalid_state(client: TestClient) -> None:
    res = client.get(
        "/api/v1/integrations/google/callback?code=mock_code&state=non_existent_state",
        follow_redirects=False,
    )
    assert res.status_code == 307
    location = res.headers["location"]
    assert "/#/connections?status=error&detail=invalid_or_expired_state" in location


def test_google_callback_successful_exchange_and_connection(client: TestClient, db_session: Session) -> None:
    user, _ = _create_user_and_auth_headers(client, db_session, "cb_success")
    raw_state = generate_oauth_state(db_session, user.id, "google")

    mock_tokens = {
        "access_token": "ya29.mock_access_token_abc123",
        "refresh_token": "1//mock_refresh_token_xyz789",
        "expires_in": 3600,
        "scope": "openid https://www.googleapis.com/auth/gmail.readonly",
    }
    mock_userinfo = {
        "sub": "google-user-sub-9999",
        "email": "testuser@gmail.com",
    }

    with (
        patch("app.api.routes.integrations_google.exchange_code_for_tokens", return_value=mock_tokens),
        patch("app.api.routes.integrations_google.fetch_google_userinfo", return_value=mock_userinfo),
    ):
        res = client.get(
            f"/api/v1/integrations/google/callback?code=valid_code&state={raw_state}",
            follow_redirects=False,
        )

    assert res.status_code == 307
    location = res.headers["location"]
    assert "/#/connections?status=connected&provider=google" in location
    # Security check: no credentials or tokens in redirect URL
    assert "mock_access_token" not in location
    assert "mock_refresh_token" not in location

    # Verify external account persisted
    account = db_session.scalar(
        select(ExternalAccount).where(
            ExternalAccount.user_id == user.id,
            ExternalAccount.provider == "google",
        )
    )
    assert account is not None
    assert account.provider_user_id == "google-user-sub-9999"
    assert account.email == "testuser@gmail.com"
    assert account.status == ExternalAccountStatus.active

    # Verify tokens are encrypted
    assert account.access_token_enc != b"ya29.mock_access_token_abc123"
    dec_access, dec_refresh = get_decrypted_tokens(account)
    assert dec_access == "ya29.mock_access_token_abc123"
    assert dec_refresh == "1//mock_refresh_token_xyz789"


def test_google_callback_replay_rejected(client: TestClient, db_session: Session) -> None:
    user, _ = _create_user_and_auth_headers(client, db_session, "cb_replay")
    raw_state = generate_oauth_state(db_session, user.id, "google")

    mock_tokens = {"access_token": "token1", "refresh_token": "ref1", "expires_in": 3600}
    mock_userinfo = {"sub": "google-sub-replay", "email": "replay@gmail.com"}

    with (
        patch("app.api.routes.integrations_google.exchange_code_for_tokens", return_value=mock_tokens),
        patch("app.api.routes.integrations_google.fetch_google_userinfo", return_value=mock_userinfo),
    ):
        # First attempt succeeds
        res1 = client.get(
            f"/api/v1/integrations/google/callback?code=c1&state={raw_state}",
            follow_redirects=False,
        )
        assert res1.status_code == 307
        assert "status=connected" in res1.headers["location"]

        # Replay attempt fails because state was already consumed
        res2 = client.get(
            f"/api/v1/integrations/google/callback?code=c2&state={raw_state}",
            follow_redirects=False,
        )
        assert res2.status_code == 307
        assert "detail=invalid_or_expired_state" in res2.headers["location"]
