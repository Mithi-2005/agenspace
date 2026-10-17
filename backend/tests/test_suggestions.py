import uuid
from datetime import UTC, datetime, timedelta

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import hash_password
from app.models.event import Event, EventSource
from app.models.integration import GmailMessage, Suggestion, SuggestionStatus, SuggestionType
from app.models.task import Task, TaskSource
from app.models.user import User
from app.services.external_account_service import delete_external_account, upsert_external_account


@pytest.fixture(autouse=True)
def setup_encryption_key(monkeypatch: pytest.MonkeyPatch) -> str:
    key = Fernet.generate_key().decode("utf-8")
    test_settings = Settings(INTEGRATION_ENCRYPTION_KEY=SecretStr(key))
    monkeypatch.setattr("app.core.config.get_settings", lambda: test_settings)
    monkeypatch.setattr("app.integrations.crypto.get_settings", lambda: test_settings)
    return key


def _create_user_and_token(client: TestClient, db: Session, prefix: str = "sug_user") -> tuple[User, dict]:
    unique_email = f"{prefix}_{uuid.uuid4().hex[:8]}@example.com"
    user = User(
        email=unique_email,
        display_name="Suggestion Tester",
        password_hash=hash_password("Password123!"),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    res = client.post("/api/v1/auth/login", json={"email": unique_email, "password": "Password123!"})
    token = res.json()["access_token"]
    return user, {"Authorization": f"Bearer {token}"}


def test_list_pending_suggestions(client: TestClient, db_session: Session) -> None:
    user, headers = _create_user_and_token(client, db_session, "list_sug")

    # Insert pending suggestion
    sug = Suggestion(
        user_id=user.id,
        suggestion_type=SuggestionType.task,
        dedup_key="msg1:task:assignment",
        title="Action: Complete Calculus Homework",
        description="Homework 3 due tomorrow",
        suggested_date=datetime.now(UTC) + timedelta(days=1),
        source_email_from="prof@college.edu",
        source_email_subject="Math Homework Notice",
        confidence="high",
        status=SuggestionStatus.pending,
    )
    db_session.add(sug)
    db_session.commit()

    res = client.get("/api/v1/suggestions", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["title"] == "Action: Complete Calculus Homework"
    assert data[0]["status"] == "pending"


def test_accept_task_suggestion_creates_confirmed_task(client: TestClient, db_session: Session) -> None:
    user, headers = _create_user_and_token(client, db_session, "accept_task")

    sug = Suggestion(
        user_id=user.id,
        suggestion_type=SuggestionType.task,
        dedup_key="msg_task:1",
        title="Submit CS Project Proposal",
        description="Project outline due next week",
        suggested_date=datetime.now(UTC) + timedelta(days=7),
        source_email_from="cs_dept@univ.edu",
        source_email_subject="Proposal Deadline",
        confidence="high",
        status=SuggestionStatus.pending,
    )
    db_session.add(sug)
    db_session.commit()

    # Accept suggestion
    res = client.post(f"/api/v1/suggestions/{sug.id}/accept", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "accepted"
    assert data["created_type"] == "task"

    # Verify task was created in tasks table
    task_id = uuid.UUID(data["item_id"])
    task = db_session.scalar(select(Task).where(Task.id == task_id))
    assert task is not None
    assert task.user_id == user.id
    assert task.title == "Submit CS Project Proposal"
    assert task.source == TaskSource.confirmed

    # Verify suggestion state updated
    db_session.refresh(sug)
    assert sug.status == SuggestionStatus.accepted
    assert sug.actioned_task_id == task.id

    # Repeated accept is idempotent
    repeat_res = client.post(f"/api/v1/suggestions/{sug.id}/accept", headers=headers)
    assert repeat_res.status_code == 200
    assert repeat_res.json()["item_id"] == str(task_id)


def test_accept_event_suggestion_creates_confirmed_event(client: TestClient, db_session: Session) -> None:
    user, headers = _create_user_and_token(client, db_session, "accept_evt")

    event_date = datetime.now(UTC) + timedelta(days=2)
    sug = Suggestion(
        user_id=user.id,
        suggestion_type=SuggestionType.event,
        dedup_key="msg_evt:1",
        title="Quarterly Review Meeting",
        suggested_date=event_date,
        suggested_end_date=event_date + timedelta(hours=1),
        source_email_from="hr@company.com",
        source_email_subject="Review Invitation",
        confidence="high",
        status=SuggestionStatus.pending,
    )
    db_session.add(sug)
    db_session.commit()

    res = client.post(f"/api/v1/suggestions/{sug.id}/accept", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["created_type"] == "event"

    event_id = uuid.UUID(data["item_id"])
    event = db_session.scalar(select(Event).where(Event.id == event_id))
    assert event is not None
    assert event.user_id == user.id
    assert event.title == "Quarterly Review Meeting"
    assert event.source == EventSource.confirmed


def test_dismiss_suggestion(client: TestClient, db_session: Session) -> None:
    user, headers = _create_user_and_token(client, db_session, "dismiss_sug")

    sug = Suggestion(
        user_id=user.id,
        suggestion_type=SuggestionType.task,
        dedup_key="msg_dismiss:1",
        title="Unwanted Newsletter Action",
        source_email_from="news@spam.com",
        source_email_subject="Daily Digest",
        confidence="low",
        status=SuggestionStatus.pending,
    )
    db_session.add(sug)
    db_session.commit()

    res = client.post(f"/api/v1/suggestions/{sug.id}/dismiss", headers=headers)
    assert res.status_code == 200
    assert res.json()["status"] == "dismissed"

    # Pending list should now be empty
    list_res = client.get("/api/v1/suggestions", headers=headers)
    assert len(list_res.json()) == 0

    accept_res = client.post(f"/api/v1/suggestions/{sug.id}/accept", headers=headers)
    assert accept_res.status_code == 422
    assert db_session.scalar(select(Task).where(Task.user_id == user.id)) is None


def test_user_isolation_cannot_accept_another_users_suggestion(client: TestClient, db_session: Session) -> None:
    user_a, _ = _create_user_and_token(client, db_session, "user_a")
    _, headers_b = _create_user_and_token(client, db_session, "user_b")

    sug_a = Suggestion(
        user_id=user_a.id,
        suggestion_type=SuggestionType.task,
        dedup_key="user_a_key",
        title="Confidential Task for User A",
        source_email_from="boss@work.com",
        source_email_subject="Confidential",
        confidence="high",
        status=SuggestionStatus.pending,
    )
    db_session.add(sug_a)
    db_session.commit()

    # User B tries to accept User A's suggestion
    res = client.post(f"/api/v1/suggestions/{sug_a.id}/accept", headers=headers_b)
    assert res.status_code == 404


def test_dashboard_aggregation_includes_pending_suggestions(client: TestClient, db_session: Session) -> None:
    user, headers = _create_user_and_token(client, db_session, "dash_sug")

    sug = Suggestion(
        user_id=user.id,
        suggestion_type=SuggestionType.task,
        dedup_key="dash_key",
        title="Prepare presentation",
        source_email_from="lead@work.com",
        source_email_subject="Slides needed",
        confidence="high",
        status=SuggestionStatus.pending,
    )
    db_session.add(sug)
    db_session.commit()

    res = client.get("/api/v1/dashboard", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "pending_suggestions" in data
    assert len(data["pending_suggestions"]) >= 1
    assert data["pending_suggestions"][0]["title"] == "Prepare presentation"


def test_disconnecting_account_preserves_confirmed_tasks_and_events(client: TestClient, db_session: Session) -> None:
    user, headers = _create_user_and_token(client, db_session, "disconn_pres")

    # Connect external account
    account = upsert_external_account(
        db=db_session,
        user_id=user.id,
        provider="google",
        provider_user_id="sub-disconnect-test",
        access_token="tok",
    )

    # Add message
    msg = GmailMessage(
        user_id=user.id,
        external_account_id=account.id,
        message_id="msg_to_delete",
        thread_id="th1",
        sender="teacher@school.edu",
        subject="Important project",
        received_at=datetime.now(UTC),
    )
    db_session.add(msg)
    db_session.flush()

    # Add suggestion and accept it
    sug = Suggestion(
        user_id=user.id,
        message_id=msg.id,
        suggestion_type=SuggestionType.task,
        dedup_key="del_test:task",
        title="Complete Final Term Paper",
        source_email_from="teacher@school.edu",
        source_email_subject="Important project",
        confidence="high",
        status=SuggestionStatus.pending,
    )
    db_session.add(sug)
    db_session.commit()

    # Accept it
    accept_res = client.post(f"/api/v1/suggestions/{sug.id}/accept", headers=headers)
    assert accept_res.status_code == 200
    created_task_id = uuid.UUID(accept_res.json()["item_id"])

    # Disconnect account
    delete_external_account(db_session, user.id, "google")

    # Confirmed task MUST still exist!
    task = db_session.scalar(select(Task).where(Task.id == created_task_id))
    assert task is not None
    assert task.title == "Complete Final Term Paper"
    assert task.user_id == user.id

    # Raw GmailMessage should be deleted by foreign key cascade
    msg_check = db_session.scalar(select(GmailMessage).where(GmailMessage.user_id == user.id))
    assert msg_check is None
