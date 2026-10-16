import uuid
from unittest.mock import MagicMock, patch

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import hash_password
from app.models.external_account import ExternalAccount
from app.models.integration import GmailMessage, IntegrationSyncState, Suggestion
from app.models.user import User
from app.services.external_account_service import upsert_external_account


@pytest.fixture(autouse=True)
def setup_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    key = Fernet.generate_key().decode("utf-8")
    test_settings = Settings(
        GOOGLE_CLIENT_ID="test-client-id",
        GOOGLE_CLIENT_SECRET=SecretStr("test-client-secret"),
        GOOGLE_REDIRECT_URI="http://localhost:8000/api/v1/integrations/google/callback",
        INTEGRATION_ENCRYPTION_KEY=SecretStr(key),
    )
    monkeypatch.setattr("app.core.config.get_settings", lambda: test_settings)
    monkeypatch.setattr("app.integrations.google.client.get_settings", lambda: test_settings)
    monkeypatch.setattr("app.integrations.crypto.get_settings", lambda: test_settings)


def _setup_connected_user(client: TestClient, db: Session, prefix: str = "sync_user") -> tuple[User, dict, ExternalAccount]:
    unique_email = f"{prefix}_{uuid.uuid4().hex[:8]}@example.com"
    user = User(
        email=unique_email,
        display_name="Sync User",
        password_hash=hash_password("Password123!"),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    res = client.post("/api/v1/auth/login", json={"email": unique_email, "password": "Password123!"})
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    account = upsert_external_account(
        db=db,
        user_id=user.id,
        provider="google",
        provider_user_id=f"sub-{user.id}",
        access_token="initial-access-token",
        refresh_token="initial-refresh-token",
        email=f"google-{unique_email}",
    )
    return user, headers, account


def test_status_disconnected_user(client: TestClient, db_session: Session) -> None:
    unique_email = f"unconn_{uuid.uuid4().hex[:8]}@example.com"
    user = User(
        email=unique_email,
        display_name="Unconnected User",
        password_hash=hash_password("Password123!"),
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()

    res = client.post("/api/v1/auth/login", json={"email": unique_email, "password": "Password123!"})
    headers = {"Authorization": f"Bearer {res.json()['access_token']}"}

    status_res = client.get("/api/v1/integrations/google/status", headers=headers)
    assert status_res.status_code == 200
    data = status_res.json()
    assert data["is_connected"] is False
    assert data["email"] is None


def test_status_connected_user(client: TestClient, db_session: Session) -> None:
    _user, headers, account = _setup_connected_user(client, db_session, "stat_conn")

    status_res = client.get("/api/v1/integrations/google/status", headers=headers)
    assert status_res.status_code == 200
    data = status_res.json()
    assert data["is_connected"] is True
    assert data["email"] == account.email
    assert data["status"] == "active"


def test_trigger_sync_success_with_mocked_gmail(client: TestClient, db_session: Session) -> None:
    user, headers, account = _setup_connected_user(client, db_session, "sync_ok")

    mock_list_response = MagicMock()
    mock_list_response.status_code = 200
    mock_list_response.json.return_value = {
        "messages": [
            {"id": "msg_001", "threadId": "t_001"},
            {"id": "msg_002", "threadId": "t_002"},
        ]
    }

    mock_msg1_response = MagicMock()
    mock_msg1_response.status_code = 200
    mock_msg1_response.json.return_value = {
        "id": "msg_001",
        "threadId": "t_001",
        "snippet": "Your math homework assignment is due tomorrow at 5pm.",
        "historyId": "12345",
        "payload": {
            "headers": [
                {"name": "From", "value": "Prof. Smith <smith@university.edu>"},
                {"name": "Subject", "value": "Assignment 4 Due Date Reminder"},
                {"name": "Date", "value": "Wed, 15 Oct 2026 10:00:00 +0000"},
            ]
        },
    }

    mock_msg2_response = MagicMock()
    mock_msg2_response.status_code = 200
    mock_msg2_response.json.return_value = {
        "id": "msg_002",
        "threadId": "t_002",
        "snippet": "Join our project sync meeting on Friday.",
        "historyId": "12346",
        "payload": {
            "headers": [
                {"name": "From", "value": "Colleague <colleague@work.com>"},
                {"name": "Subject", "value": "Project Sync Meeting"},
                {"name": "Date", "value": "Wed, 15 Oct 2026 11:00:00 +0000"},
            ]
        },
    }

    def mock_get(url: str, *args, **kwargs):
        if url.endswith("/messages"):
            return mock_list_response
        elif url.endswith("/msg_001"):
            return mock_msg1_response
        elif url.endswith("/msg_002"):
            return mock_msg2_response
        raise ValueError(f"Unexpected url {url}")

    with patch("httpx.Client.get", side_effect=mock_get):
        res = client.post("/api/v1/integrations/google/sync", headers=headers)

    assert res.status_code == 200
    result_data = res.json()
    assert result_data["status"] == "success"
    assert result_data["messages_synced"] == 2
    assert result_data["suggestions_created"] >= 1

    # Verify messages in db
    msgs = list(db_session.scalars(select(GmailMessage).where(GmailMessage.user_id == user.id)).all())
    assert len(msgs) == 2
    subjects = [m.subject for m in msgs]
    assert "Assignment 4 Due Date Reminder" in subjects
    assert "Project Sync Meeting" in subjects

    # Verify suggestions created
    sugs = list(db_session.scalars(select(Suggestion).where(Suggestion.user_id == user.id)).all())
    assert len(sugs) >= 1

    # Verify sync state cursor
    sync_state = db_session.scalar(select(IntegrationSyncState).where(IntegrationSyncState.external_account_id == account.id))
    assert sync_state is not None
    assert sync_state.last_sync_status == "success"
    assert sync_state.last_history_id == "12346"


def test_sync_idempotency_prevents_duplicate_messages(client: TestClient, db_session: Session) -> None:
    user, headers, _account = _setup_connected_user(client, db_session, "idemp")

    mock_list_response = MagicMock()
    mock_list_response.status_code = 200
    mock_list_response.json.return_value = {"messages": [{"id": "single_msg", "threadId": "t_single"}]}

    mock_msg_response = MagicMock()
    mock_msg_response.status_code = 200
    mock_msg_response.json.return_value = {
        "id": "single_msg",
        "threadId": "t_single",
        "snippet": "Exam deadline is approaching.",
        "payload": {
            "headers": [
                {"name": "From", "value": "Admin <admin@edu.com>"},
                {"name": "Subject", "value": "Final Exam Notice"},
                {"name": "Date", "value": "Wed, 15 Oct 2026 12:00:00 +0000"},
            ]
        },
    }

    def mock_get(url: str, *args, **kwargs):
        if url.endswith("/messages"):
            return mock_list_response
        return mock_msg_response

    with patch("httpx.Client.get", side_effect=mock_get):
        # Run sync 1
        res1 = client.post("/api/v1/integrations/google/sync", headers=headers)
        assert res1.json()["messages_synced"] == 1

        # Run sync 2 (same message)
        res2 = client.post("/api/v1/integrations/google/sync", headers=headers)
        assert res2.json()["messages_synced"] == 0

    # Exactly 1 message in database
    msgs = list(db_session.scalars(select(GmailMessage).where(GmailMessage.user_id == user.id)).all())
    assert len(msgs) == 1


def test_disconnect_google_cleans_up_metadata(client: TestClient, db_session: Session) -> None:
    user, headers, _account = _setup_connected_user(client, db_session, "disconn")

    # Disconnect
    res = client.delete("/api/v1/integrations/google/disconnect", headers=headers)
    assert res.status_code == 200
    assert res.json()["status"] == "disconnected"

    # Status is now disconnected
    status_res = client.get("/api/v1/integrations/google/status", headers=headers)
    assert status_res.json()["is_connected"] is False

    # Account removed
    acc = db_session.scalar(select(ExternalAccount).where(ExternalAccount.user_id == user.id))
    assert acc is None
