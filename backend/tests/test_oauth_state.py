import concurrent.futures
import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password, hash_token
from app.models.oauth_state import OAuthState
from app.models.user import User
from app.services.oauth_state_service import (
    OAuthStateAlreadyUsedError,
    OAuthStateError,
    OAuthStateExpiredError,
    OAuthStateInvalidError,
    OAuthStateNotFoundError,
    OAuthStateProviderMismatchError,
    generate_oauth_state,
    validate_and_consume_state,
)
from tests.conftest import TestingSessionLocal, test_engine


def _create_test_user(db: Session, email_prefix: str = "oauth_test") -> User:
    unique_email = f"{email_prefix}_{uuid.uuid4().hex[:8]}@example.com"
    user = User(
        email=unique_email,
        display_name="OAuth Tester",
        password_hash=hash_password("Password123!"),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_generate_oauth_state_randomness_and_hashing(db_session: Session) -> None:
    user = _create_test_user(db_session)

    raw_state_1 = generate_oauth_state(db_session, user.id, "google")
    raw_state_2 = generate_oauth_state(db_session, user.id, "google")

    assert raw_state_1 != raw_state_2
    assert len(raw_state_1) >= 40

    # Ensure only SHA-256 hash is in the database, never the raw token
    hash_1 = hash_token(raw_state_1)
    record = db_session.scalar(select(OAuthState).where(OAuthState.state_hash == hash_1))
    assert record is not None
    assert record.user_id == user.id
    assert record.provider == "google"
    assert record.is_used is False
    assert record.expires_at > datetime.now(UTC)

    # Ensure raw state is not stored anywhere
    assert record.state_hash != raw_state_1


def test_validate_and_consume_state_success(db_session: Session) -> None:
    user = _create_test_user(db_session)
    raw_state = generate_oauth_state(db_session, user.id, "google")

    consumed = validate_and_consume_state(db_session, raw_state, "google")
    assert consumed.user_id == user.id
    assert consumed.provider == "google"
    assert consumed.is_used is True

    # Check persistence
    db_record = db_session.scalar(select(OAuthState).where(OAuthState.id == consumed.id))
    assert db_record is not None
    assert db_record.is_used is True


def test_unknown_state_rejected(db_session: Session) -> None:
    fake_token = "totally-unknown-random-token-xyz"
    with pytest.raises(OAuthStateNotFoundError) as exc_info:
        validate_and_consume_state(db_session, fake_token, "google")

    # Ensure raw token and hash are never leaked in error messages
    error_msg = str(exc_info.value)
    assert fake_token not in error_msg
    assert hash_token(fake_token) not in error_msg


def test_expired_state_rejected(db_session: Session) -> None:
    user = _create_test_user(db_session)
    # Generate an already-expired state
    raw_state = generate_oauth_state(db_session, user.id, "google", expires_in_seconds=-30)

    with pytest.raises(OAuthStateExpiredError) as exc_info:
        validate_and_consume_state(db_session, raw_state, "google")

    assert raw_state not in str(exc_info.value)


def test_already_consumed_state_rejected(db_session: Session) -> None:
    user = _create_test_user(db_session)
    raw_state = generate_oauth_state(db_session, user.id, "google")

    # First consumption succeeds
    first_consumed = validate_and_consume_state(db_session, raw_state, "google")
    assert first_consumed.is_used is True

    # Replay consumption fails
    with pytest.raises(OAuthStateAlreadyUsedError) as exc_info:
        validate_and_consume_state(db_session, raw_state, "google")

    assert raw_state not in str(exc_info.value)


def test_wrong_provider_rejected(db_session: Session) -> None:
    user = _create_test_user(db_session)
    raw_state = generate_oauth_state(db_session, user.id, "google")

    with pytest.raises(OAuthStateProviderMismatchError) as exc_info:
        validate_and_consume_state(db_session, raw_state, "github")

    assert raw_state not in str(exc_info.value)


def test_empty_inputs_rejected(db_session: Session) -> None:
    user = _create_test_user(db_session)

    with pytest.raises(OAuthStateInvalidError):
        generate_oauth_state(db_session, user.id, "")

    with pytest.raises(OAuthStateInvalidError):
        validate_and_consume_state(db_session, "", "google")

    with pytest.raises(OAuthStateInvalidError):
        validate_and_consume_state(db_session, "valid-looking-token", "")


def test_concurrent_consumption_under_postgresql() -> None:
    """
    Verify PostgreSQL row-locking and transaction boundaries under concurrent execution.

    Spawns two concurrent threads with distinct PostgreSQL connections/sessions.
    Both attempt to consume the exact same raw_state simultaneously.
    PostgreSQL row-level locking ensures exactly one succeeds and the other receives
    OAuthStateAlreadyUsedError.
    """
    # Create user in dedicated session
    setup_conn = test_engine.connect()
    setup_session = TestingSessionLocal(bind=setup_conn)
    user = _create_test_user(setup_session, email_prefix="concurrent_test")
    raw_state = generate_oauth_state(setup_session, user.id, "google")
    setup_session.close()
    setup_conn.close()

    results: list[dict] = []

    def _worker() -> dict:
        conn = test_engine.connect()
        session = TestingSessionLocal(bind=conn)
        res = {"success": False, "error_type": None}
        try:
            consumed = validate_and_consume_state(session, raw_state, "google")
            res["success"] = True
            res["user_id"] = str(consumed.user_id)
        except OAuthStateError as exc:
            res["error_type"] = type(exc).__name__
        finally:
            session.close()
            conn.close()
        return res

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        future1 = executor.submit(_worker)
        future2 = executor.submit(_worker)
        results = [future1.result(), future2.result()]

    success_count = sum(1 for r in results if r["success"] is True)
    replay_count = sum(1 for r in results if r["error_type"] == "OAuthStateAlreadyUsedError")

    assert success_count == 1, (
        f"Expected exactly 1 success, got {success_count}. Results: {results}"
    )
    assert replay_count == 1, (
        f"Expected exactly 1 OAuthStateAlreadyUsedError, got {replay_count}. Results: {results}"
    )
