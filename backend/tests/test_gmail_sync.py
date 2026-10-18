import base64
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
from app.plugins.gmail.intelligence import GmailExtraction, GmailIntelligenceError
from app.plugins.gmail.suggestions import dismiss_suggestion
from app.plugins.gmail.sync import sync_gmail_for_account
from app.services.external_account_service import upsert_external_account


@pytest.fixture(autouse=True)
def setup_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    key = Fernet.generate_key().decode("utf-8")
    test_settings = Settings(
        GOOGLE_CLIENT_ID="test-client-id",
        GOOGLE_CLIENT_SECRET=SecretStr("test-client-secret"),
        GOOGLE_REDIRECT_URI="http://localhost:8000/api/v1/integrations/google/callback",
        INTEGRATION_ENCRYPTION_KEY=SecretStr(key),
        AI_PROVIDER="xai",
        XAI_API_KEY=SecretStr("test-xai-key"),
    )
    monkeypatch.setattr("app.core.config.get_settings", lambda: test_settings)
    monkeypatch.setattr("app.plugins.gmail.sync.get_settings", lambda: test_settings)
    monkeypatch.setattr("app.integrations.google.client.get_settings", lambda: test_settings)
    monkeypatch.setattr("app.integrations.crypto.get_settings", lambda: test_settings)


def _setup_connected_user(
    client: TestClient, db: Session, prefix: str = "sync_user"
) -> tuple[User, dict, ExternalAccount]:
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

    res = client.post(
        "/api/v1/auth/login", json={"email": unique_email, "password": "Password123!"}
    )
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

    res = client.post(
        "/api/v1/auth/login", json={"email": unique_email, "password": "Password123!"}
    )
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
            "mimeType": "text/plain",
            "headers": [
                {"name": "From", "value": "Prof. Smith <smith@university.edu>"},
                {"name": "Subject", "value": "Assignment 4 Due Date Reminder"},
                {"name": "Date", "value": "Wed, 15 Oct 2026 10:00:00 +0000"},
            ],
            "body": {
                "data": base64.urlsafe_b64encode(b"Please submit your project by tomorrow.")
                .decode()
                .rstrip("=")
            },
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
            "mimeType": "text/plain",
            "headers": [
                {"name": "From", "value": "Colleague <colleague@work.com>"},
                {"name": "Subject", "value": "Project Sync Meeting"},
                {"name": "Date", "value": "Wed, 15 Oct 2026 11:00:00 +0000"},
            ],
            "body": {
                "data": base64.urlsafe_b64encode(b"Let us meet Friday at 3 PM.")
                .decode()
                .rstrip("=")
            },
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

    with (
        patch("httpx.Client.get", side_effect=mock_get),
        patch(
            "app.plugins.gmail.intelligence.GmailIntelligenceService.extract",
            side_effect=[
                GmailExtraction(
                    suggestions=[
                        {
                            "type": "task",
                            "title": "Submit project",
                            "description": "Submit the project.",
                            "priority": "high",
                            "due_at": "2026-10-16T15:00:00+05:30",
                            "confidence": 0.9,
                            "evidence": "submit your project by tomorrow",
                            "timezone": "Asia/Kolkata",
                        }
                    ]
                ),
                GmailExtraction(
                    suggestions=[
                        {
                            "type": "event",
                            "title": "Project sync",
                            "description": "Meet with colleague.",
                            "starts_at": "2026-10-16T15:00:00+05:30",
                            "ends_at": None,
                            "confidence": 0.8,
                            "evidence": "meet Friday at 3 PM",
                            "timezone": "Asia/Kolkata",
                        }
                    ]
                ),
            ],
        ),
    ):
        res = client.post("/api/v1/integrations/google/sync", headers=headers)

    assert res.status_code == 200
    result_data = res.json()
    assert result_data["status"] == "success"
    assert result_data["messages_synced"] == 2
    assert result_data["suggestions_created"] == 2

    # Verify messages in db
    msgs = list(
        db_session.scalars(select(GmailMessage).where(GmailMessage.user_id == user.id)).all()
    )
    assert len(msgs) == 2
    subjects = [m.subject for m in msgs]
    assert "Assignment 4 Due Date Reminder" in subjects
    assert "Project Sync Meeting" in subjects

    # Verify suggestions created
    sugs = list(db_session.scalars(select(Suggestion).where(Suggestion.user_id == user.id)).all())
    assert len(sugs) >= 1

    # Verify sync state cursor
    sync_state = db_session.scalar(
        select(IntegrationSyncState).where(IntegrationSyncState.external_account_id == account.id)
    )
    assert sync_state is not None
    assert sync_state.last_sync_status == "success"
    assert sync_state.last_history_id == "12346"


def test_sync_idempotency_prevents_duplicate_messages(
    client: TestClient, db_session: Session
) -> None:
    user, headers, _account = _setup_connected_user(client, db_session, "idemp")

    mock_list_response = MagicMock()
    mock_list_response.status_code = 200
    mock_list_response.json.return_value = {
        "messages": [{"id": "single_msg", "threadId": "t_single"}]
    }

    mock_msg_response = MagicMock()
    mock_msg_response.status_code = 200
    mock_msg_response.json.return_value = {
        "id": "single_msg",
        "threadId": "t_single",
        "snippet": "Exam deadline is approaching.",
        "payload": {
            "mimeType": "text/plain",
            "headers": [
                {"name": "From", "value": "Admin <admin@edu.com>"},
                {"name": "Subject", "value": "Final Exam Notice"},
                {"name": "Date", "value": "Wed, 15 Oct 2026 12:00:00 +0000"},
            ],
            "body": {"data": base64.urlsafe_b64encode(b"No action needed.").decode().rstrip("=")},
        },
    }

    def mock_get(url: str, *args, **kwargs):
        if url.endswith("/messages"):
            return mock_list_response
        return mock_msg_response

    extracted = GmailExtraction(
        suggestions=[
            {
                "type": "task",
                "title": "Review the exam guide",
                "description": "Read the updated exam guide.",
                "priority": "medium",
                "due_at": None,
                "confidence": 0.8,
                "evidence": "Please review the updated exam guide.",
            }
        ]
    )
    with (
        patch("httpx.Client.get", side_effect=mock_get),
        patch(
            "app.plugins.gmail.intelligence.GmailIntelligenceService.extract",
            return_value=extracted,
        ) as extract,
    ):
        # Run sync 1
        res1 = client.post("/api/v1/integrations/google/sync", headers=headers)
        assert res1.json()["messages_synced"] == 1
        assert res1.json()["suggestions_created"] == 1

        suggestion = db_session.scalar(select(Suggestion).where(Suggestion.user_id == user.id))
        assert suggestion is not None
        dismiss_suggestion(db_session, user.id, suggestion.id)

        # Run sync 2 (same message)
        res2 = client.post("/api/v1/integrations/google/sync", headers=headers)
        assert res2.json()["messages_synced"] == 0
        assert extract.call_count == 1

    # Exactly 1 message in database
    msgs = list(
        db_session.scalars(select(GmailMessage).where(GmailMessage.user_id == user.id)).all()
    )
    assert len(msgs) == 1
    assert (
        db_session.scalar(select(Suggestion).where(Suggestion.user_id == user.id)).status.value
        == "dismissed"
    )


def test_sync_paginates_until_requested_bounded_batch_is_fetched(
    client: TestClient, db_session: Session
) -> None:
    _user, _headers, account = _setup_connected_user(client, db_session, "pages")
    message_ids = [f"page_msg_{index}" for index in range(45)]
    page_calls: list[dict] = []
    empty_body = base64.urlsafe_b64encode(b"No action needed.").decode().rstrip("=")

    def mock_get(url: str, *args, **kwargs):
        if url.endswith("/messages"):
            params = kwargs["params"]
            page_calls.append(dict(params))
            offset = 0 if not params.get("pageToken") else int(params["pageToken"])
            page_ids = message_ids[offset : offset + int(params["maxResults"])]
            next_offset = offset + len(page_ids)
            response = MagicMock(status_code=200)
            response.json.return_value = {
                "messages": [{"id": value} for value in page_ids],
                "nextPageToken": str(next_offset) if next_offset < len(message_ids) else None,
            }
            return response
        response = MagicMock(status_code=200)
        response.json.return_value = {
            "payload": {
                "mimeType": "text/plain",
                "headers": [
                    {"name": "From", "value": "Sender <sender@example.com>"},
                    {"name": "Subject", "value": "FYI"},
                    {"name": "Date", "value": "Wed, 15 Oct 2026 12:00:00 +0000"},
                ],
                "body": {"data": empty_body},
            }
        }
        return response

    with (
        patch("httpx.Client.get", side_effect=mock_get),
        patch(
            "app.plugins.gmail.intelligence.GmailIntelligenceService.extract",
            return_value=GmailExtraction(suggestions=[]),
        ),
    ):
        result = sync_gmail_for_account(db_session, account, max_results=45)

    assert result["status"] == "success"
    assert result["messages_synced"] == 45
    assert len(page_calls) == 3
    assert page_calls[0]["q"] == "newer_than:14d"
    assert page_calls[1]["pageToken"] == "20"
    assert page_calls[2]["pageToken"] == "40"


def test_gmail_detail_failure_is_reported_as_partial_sync(
    client: TestClient, db_session: Session
) -> None:
    _user, headers, _account = _setup_connected_user(client, db_session, "partial_fetch")
    list_response = MagicMock(status_code=200)
    list_response.json.return_value = {"messages": [{"id": "fetch_1"}, {"id": "fetch_2"}]}
    server_error = MagicMock(status_code=503, headers={"Retry-After": "0"})
    server_error.json.return_value = {"error": {"message": "temporary"}}
    with (
        patch("httpx.Client.get", side_effect=[list_response, server_error, server_error, server_error, server_error]),
        patch("app.plugins.gmail.sync.time.sleep"),
        patch("app.plugins.gmail.sync.random.uniform", return_value=0),
    ):
        response = client.post("/api/v1/integrations/google/sync", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "partial"
    assert response.json()["fetch_failures"] == 2


def test_failed_extraction_can_be_retried_explicitly(client: TestClient, db_session: Session) -> None:
    _user, headers, _account = _setup_connected_user(client, db_session, "retry_failed")
    listed = MagicMock(status_code=200)
    listed.json.return_value = {"messages": [{"id": "retry_failed_msg"}]}
    detail = MagicMock(status_code=200)
    detail.json.return_value = {
        "payload": {
            "mimeType": "text/plain",
            "headers": [
                {"name": "From", "value": "Sender <sender@example.com>"},
                {"name": "Subject", "value": "Review"},
                {"name": "Date", "value": "Wed, 15 Oct 2026 12:00:00 +0000"},
            ],
            "body": {"data": base64.urlsafe_b64encode(b"Please review.").decode().rstrip("=")},
        }
    }
    with (
        patch("httpx.Client.get", side_effect=[listed, detail, listed, detail]),
        patch(
            "app.plugins.gmail.intelligence.GmailIntelligenceService.extract",
            side_effect=[
                GmailIntelligenceError("Invalid structured output", retryable=False),
                GmailExtraction(suggestions=[]),
            ],
        ) as extract,
    ):
        first = client.post("/api/v1/integrations/google/sync", headers=headers)
        assert first.json()["status"] == "partial"
        second = client.post("/api/v1/integrations/google/retry-failed", headers=headers)
    assert second.status_code == 200
    assert second.json()["status"] == "success"
    assert extract.call_count == 2


def test_transient_grok_failure_keeps_google_connected_and_retries(
    client: TestClient, db_session: Session
) -> None:
    user, headers, account = _setup_connected_user(client, db_session, "retry_ai")
    list_response = MagicMock(status_code=200)
    list_response.json.return_value = {"messages": [{"id": "retry_msg"}]}
    message_response = MagicMock(status_code=200)
    message_response.json.return_value = {
        "id": "retry_msg",
        "snippet": "Please review this plan.",
        "payload": {
            "mimeType": "text/plain",
            "headers": [
                {"name": "From", "value": "Sender <sender@example.com>"},
                {"name": "Subject", "value": "Plan review"},
                {"name": "Date", "value": "Wed, 15 Oct 2026 12:00:00 +0000"},
            ],
            "body": {
                "data": base64.urlsafe_b64encode(b"Please review this plan.").decode().rstrip("=")
            },
        },
    }

    def mock_get(url: str, *args, **kwargs):
        return list_response if url.endswith("/messages") else message_response

    with (
        patch("httpx.Client.get", side_effect=mock_get),
        patch(
            "app.plugins.gmail.intelligence.GmailIntelligenceService.extract",
            side_effect=[
                GmailIntelligenceError("Temporary provider failure", retryable=True),
                GmailExtraction(suggestions=[]),
            ],
        ) as extract,
    ):
        first = client.post("/api/v1/integrations/google/sync", headers=headers)
        assert first.status_code == 200
        assert first.json()["status"] == "partial"
        assert extract.call_count == 1

        second = client.post("/api/v1/integrations/google/sync", headers=headers)
        assert second.status_code == 200
        assert second.json()["status"] == "success"
        assert extract.call_count == 2

    db_session.refresh(account)
    assert account.status.value == "active"
    message = db_session.scalar(
        select(GmailMessage).where(
            GmailMessage.user_id == user.id, GmailMessage.message_id == "retry_msg"
        )
    )
    assert message is not None and message.extraction_status == "complete"


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
