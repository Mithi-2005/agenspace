import uuid

import pytest
from cryptography.fernet import Fernet
from pydantic import SecretStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import hash_password
from app.models.external_account import ExternalAccount, ExternalAccountStatus
from app.models.user import User
from app.schemas.external_account import ExternalAccountResponse
from app.services.external_account_service import (
    ExternalAccountConflictError,
    ExternalAccountNotFoundError,
    delete_external_account,
    get_decrypted_tokens,
    get_external_account,
    update_external_account_status,
    upsert_external_account,
)


@pytest.fixture(autouse=True)
def setup_encryption_key(monkeypatch: pytest.MonkeyPatch) -> str:
    key = Fernet.generate_key().decode("utf-8")
    test_settings = Settings(INTEGRATION_ENCRYPTION_KEY=SecretStr(key))
    monkeypatch.setattr("app.integrations.crypto.get_settings", lambda: test_settings)
    return key


def _create_user(db: Session, prefix: str = "ext_user") -> User:
    unique_email = f"{prefix}_{uuid.uuid4().hex[:8]}@example.com"
    user = User(
        email=unique_email,
        display_name="External User",
        password_hash=hash_password("Password123!"),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_upsert_external_account_encrypts_tokens(db_session: Session) -> None:
    user = _create_user(db_session)
    access_token = "ya29.sample_google_access_token_12345"
    refresh_token = "1//sample_google_refresh_token_67890"

    account = upsert_external_account(
        db=db_session,
        user_id=user.id,
        provider="google",
        provider_user_id="google-sub-1001",
        access_token=access_token,
        refresh_token=refresh_token,
        email="googleuser@example.com",
        scopes="https://www.googleapis.com/auth/gmail.readonly",
    )

    assert account.id is not None
    assert account.user_id == user.id
    assert account.provider == "google"
    assert account.provider_user_id == "google-sub-1001"
    assert account.email == "googleuser@example.com"
    assert account.status == ExternalAccountStatus.active

    # Stored token bytes must be encrypted and differ from plaintext
    assert isinstance(account.access_token_enc, bytes)
    assert account.access_token_enc != access_token.encode("utf-8")
    assert access_token not in str(account.access_token_enc)

    assert isinstance(account.refresh_token_enc, bytes)
    assert account.refresh_token_enc != refresh_token.encode("utf-8")
    assert refresh_token not in str(account.refresh_token_enc)

    # Tokens can be decrypted cleanly through service boundary
    dec_access, dec_refresh = get_decrypted_tokens(account)
    assert dec_access == access_token
    assert dec_refresh == refresh_token


def test_user_isolation_cannot_access_or_modify_other_user_account(db_session: Session) -> None:
    user_a = _create_user(db_session, "user_a")
    user_b = _create_user(db_session, "user_b")

    # Connect Google account for User A
    upsert_external_account(
        db=db_session,
        user_id=user_a.id,
        provider="google",
        provider_user_id="sub-user-a",
        access_token="token-a",
    )

    # User B should NOT be able to retrieve User A's account
    account_b_view = get_external_account(db_session, user_id=user_b.id, provider="google")
    assert account_b_view is None

    # User B should NOT be able to modify or revoke User A's account
    with pytest.raises(ExternalAccountNotFoundError):
        update_external_account_status(
            db_session,
            user_id=user_b.id,
            provider="google",
            status=ExternalAccountStatus.revoked,
        )

    # User B should NOT be able to delete User A's account
    deleted = delete_external_account(db_session, user_id=user_b.id, provider="google")
    assert deleted is False

    # User A's account remains intact and active
    account_a = get_external_account(db_session, user_id=user_a.id, provider="google")
    assert account_a is not None
    assert account_a.status == ExternalAccountStatus.active


def test_reconnection_preserves_existing_refresh_token(db_session: Session) -> None:
    user = _create_user(db_session)
    initial_access = "access-token-v1"
    initial_refresh = "refresh-token-permanent"

    # Initial connection with both access & refresh tokens
    upsert_external_account(
        db=db_session,
        user_id=user.id,
        provider="google",
        provider_user_id="google-sub-2002",
        access_token=initial_access,
        refresh_token=initial_refresh,
    )

    # Reconnection where Google omits refresh_token (passes None)
    new_access = "access-token-v2-reconnected"
    reconnected = upsert_external_account(
        db=db_session,
        user_id=user.id,
        provider="google",
        provider_user_id="google-sub-2002",
        access_token=new_access,
        refresh_token=None,  # Google omitted refresh token
    )

    dec_access, dec_refresh = get_decrypted_tokens(reconnected)
    assert dec_access == new_access
    # The existing refresh token MUST NOT have been overwritten or erased!
    assert dec_refresh == initial_refresh


def test_reconnection_updates_refresh_token_when_provided(db_session: Session) -> None:
    user = _create_user(db_session)

    upsert_external_account(
        db=db_session,
        user_id=user.id,
        provider="google",
        provider_user_id="google-sub-3003",
        access_token="access-1",
        refresh_token="refresh-1",
    )

    # Reconnection with explicit new refresh token
    reconnected = upsert_external_account(
        db=db_session,
        user_id=user.id,
        provider="google",
        provider_user_id="google-sub-3003",
        access_token="access-2",
        refresh_token="refresh-2",
    )

    dec_access, dec_refresh = get_decrypted_tokens(reconnected)
    assert dec_access == "access-2"
    assert dec_refresh == "refresh-2"


def test_mismatched_provider_user_id_raises_conflict(db_session: Session) -> None:
    user = _create_user(db_session)

    # Initial connection with Google sub-A
    upsert_external_account(
        db=db_session,
        user_id=user.id,
        provider="google",
        provider_user_id="google-sub-original",
        access_token="access-1",
    )

    # User attempts to connect different Google account without disconnecting first
    with pytest.raises(ExternalAccountConflictError) as exc_info:
        upsert_external_account(
            db=db_session,
            user_id=user.id,
            provider="google",
            provider_user_id="google-sub-different",
            access_token="access-2",
        )

    assert "does not match" in str(exc_info.value).lower()


def test_account_already_connected_to_another_user_raises_conflict(db_session: Session) -> None:
    user1 = _create_user(db_session, "user1")
    user2 = _create_user(db_session, "user2")

    # User 1 connects Google account
    upsert_external_account(
        db=db_session,
        user_id=user1.id,
        provider="google",
        provider_user_id="shared-google-sub",
        access_token="token-user-1",
    )

    # User 2 attempts to connect the same Google account
    with pytest.raises(ExternalAccountConflictError) as exc_info:
        upsert_external_account(
            db=db_session,
            user_id=user2.id,
            provider="google",
            provider_user_id="shared-google-sub",
            access_token="token-user-2",
        )

    assert "already connected to another user" in str(exc_info.value).lower()


def test_delete_external_account(db_session: Session) -> None:
    user = _create_user(db_session)

    upsert_external_account(
        db=db_session,
        user_id=user.id,
        provider="google",
        provider_user_id="sub-to-delete",
        access_token="token-del",
    )

    # Verify exists
    assert get_external_account(db_session, user.id, "google") is not None

    # Delete
    deleted = delete_external_account(db_session, user.id, "google")
    assert deleted is True

    # Verify gone
    assert get_external_account(db_session, user.id, "google") is None

    # Delete non-existent returns False
    assert delete_external_account(db_session, user.id, "google") is False


def test_cascade_delete_when_user_is_deleted(db_session: Session) -> None:
    user = _create_user(db_session, "cascade_user")
    user_id = user.id

    upsert_external_account(
        db=db_session,
        user_id=user_id,
        provider="google",
        provider_user_id="sub-cascade",
        access_token="token-cascade",
    )

    # Delete User
    db_session.delete(user)
    db_session.commit()

    # ExternalAccount row should be cascade-deleted
    row = db_session.scalar(select(ExternalAccount).where(ExternalAccount.user_id == user_id))
    assert row is None


def test_public_response_schema_never_exposes_tokens(db_session: Session) -> None:
    user = _create_user(db_session)
    account = upsert_external_account(
        db=db_session,
        user_id=user.id,
        provider="google",
        provider_user_id="sub-public-schema",
        access_token="secret-access-token",
        refresh_token="secret-refresh-token",
        email="public@example.com",
    )

    # Serialize to public schema
    schema = ExternalAccountResponse.model_validate(account)
    dumped = schema.model_dump()

    # Verify tokens are absent from schema representation
    assert "access_token" not in dumped
    assert "access_token_enc" not in dumped
    assert "refresh_token" not in dumped
    assert "refresh_token_enc" not in dumped
    assert dumped["provider_user_id"] == "sub-public-schema"
    assert dumped["email"] == "public@example.com"
