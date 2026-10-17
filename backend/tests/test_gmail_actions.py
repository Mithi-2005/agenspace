import uuid
from unittest.mock import MagicMock, patch

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import hash_password
from app.models.user import User
from app.services.external_account_service import upsert_external_account


@pytest.fixture(autouse=True)
def setup_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = Settings(
        GOOGLE_CLIENT_ID="test-client",
        GOOGLE_CLIENT_SECRET=SecretStr("test-secret"),
        GOOGLE_REDIRECT_URI="http://localhost:8000/api/v1/integrations/google/callback",
        INTEGRATION_ENCRYPTION_KEY=SecretStr(Fernet.generate_key().decode()),
    )
    monkeypatch.setattr("app.core.config.get_settings", lambda: settings)
    monkeypatch.setattr("app.integrations.crypto.get_settings", lambda: settings)
    monkeypatch.setattr("app.integrations.google.client.get_settings", lambda: settings)


def _connect_user(client: TestClient, db: Session) -> tuple[dict[str, str], object]:
    email = f"mail_action_{uuid.uuid4().hex[:8]}@example.com"
    user = User(
        email=email,
        display_name="Mail Action",
        password_hash=hash_password("Password123!"),
        is_active=True,
    )
    db.add(user)
    db.commit()
    response = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "Password123!"}
    )
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    account = upsert_external_account(
        db,
        user.id,
        "google",
        f"google-{user.id}",
        "access-token",
        "refresh-token",
        scopes="https://mail.google.com/",
    )
    return headers, account


def test_send_requires_user_confirmation(client: TestClient, db_session: Session) -> None:
    headers, _account = _connect_user(client, db_session)
    with patch("app.integrations.google.mail_actions._request") as request:
        response = client.post(
            "/api/v1/integrations/google/messages/send",
            headers=headers,
            json={"to": "to@example.com", "subject": "Hello", "body": "Hi", "confirmed": False},
        )
    assert response.status_code == 422
    request.assert_not_called()


def test_trash_requires_exact_message_id_confirmation(
    client: TestClient, db_session: Session
) -> None:
    headers, _account = _connect_user(client, db_session)
    with patch("app.integrations.google.mail_actions._request") as request:
        response = client.post(
            "/api/v1/integrations/google/messages/msg_123/trash",
            headers=headers,
            json={"message_id_confirmation": "another_message"},
        )
    assert response.status_code == 422
    request.assert_not_called()


def test_message_action_confirms_ownership_before_mutating(
    client: TestClient, db_session: Session
) -> None:
    headers, _account = _connect_user(client, db_session)
    missing = MagicMock(status_code=404)
    with (
        patch("app.integrations.google.mail_actions._request", return_value=missing) as request,
    ):
        response = client.post(
            "/api/v1/integrations/google/messages/msg_123/archive",
            headers=headers,
            json={"message_id_confirmation": "msg_123"},
        )
    assert response.status_code == 422
    assert request.call_count == 1


def test_permanent_delete_requires_exact_unmistakable_confirmation(
    client: TestClient, db_session: Session
) -> None:
    headers, _account = _connect_user(client, db_session)
    with patch("app.integrations.google.mail_actions._request") as request:
        bad = client.request(
            "DELETE",
            "/api/v1/integrations/google/messages/msg_123/permanently",
            headers=headers,
            json={"confirmation_phrase": "yes"},
        )
    assert bad.status_code == 422
    request.assert_not_called()

    found = MagicMock(status_code=200)
    deleted = MagicMock(status_code=204)
    with (
        patch("app.integrations.google.mail_actions._request", side_effect=[found, deleted]) as request,
    ):
        good = client.request(
            "DELETE",
            "/api/v1/integrations/google/messages/msg_123/permanently",
            headers=headers,
            json={"confirmation_phrase": "DELETE msg_123 PERMANENTLY"},
        )
    assert good.status_code == 200
    assert request.call_count == 2
