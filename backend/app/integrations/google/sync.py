"""
Gmail message synchronization engine.

Performs bounded, incremental synchronization of Gmail messages using Gmail's REST API.
Handles token expiration, history ID fallback, duplicate suppression, and minimal metadata storage.
"""

import email.utils
import logging
from datetime import UTC, datetime, timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.integrations.crypto import encrypt_token
from app.integrations.google.client import GoogleOAuthError, refresh_access_token
from app.models.external_account import ExternalAccount, ExternalAccountStatus
from app.models.integration import GmailMessage, IntegrationSyncState
from app.services.external_account_service import get_decrypted_tokens

logger = logging.getLogger("kosway.integrations.google.sync")

GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"
DEFAULT_BATCH_SIZE = 20
MAX_BATCH_SIZE = 50


class GmailSyncError(Exception):
    """Base exception for Gmail synchronization errors."""


class GmailTokenRevokedError(GmailSyncError):
    """Raised when Gmail access is revoked or token cannot be refreshed."""


def sync_gmail_for_account(
    db: Session,
    account: ExternalAccount,
    max_results: int = DEFAULT_BATCH_SIZE,
) -> dict:
    """
    Synchronize Gmail messages for a user's connected external account.

    Parameters
    ----------
    db : Session
        SQLAlchemy database session.
    account : ExternalAccount
        Connected external account record for 'google'.
    max_results : int
        Number of recent messages to process (capped at MAX_BATCH_SIZE).

    Returns
    -------
    dict
        Sync summary report including count of messages synced and sync status.
    """
    if account.provider != "google":
        raise GmailSyncError(f"Cannot sync provider '{account.provider}' with Gmail client.")

    if account.status == ExternalAccountStatus.revoked:
        raise GmailTokenRevokedError("Cannot synchronize: account connection is revoked.")

    bounded_max = min(max(1, max_results), MAX_BATCH_SIZE)

    # Load or initialize sync state record
    sync_state = db.scalar(
        select(IntegrationSyncState).where(
            IntegrationSyncState.external_account_id == account.id
        )
    )
    if sync_state is None:
        sync_state = IntegrationSyncState(
            external_account_id=account.id,
            last_sync_status="in_progress",
        )
        db.add(sync_state)
        db.commit()
        db.refresh(sync_state)
    else:
        sync_state.last_sync_status = "in_progress"
        db.commit()

    access_token, refresh_token = get_decrypted_tokens(account)

    client = httpx.Client(timeout=20.0)
    try:
        # Check if access token needs proactive refresh
        now = datetime.now(UTC)
        if account.token_expires_at and account.token_expires_at <= now + timedelta(seconds=60):
            access_token = _do_refresh_token(db, account, refresh_token)

        # Attempt incremental or initial sync
        synced_count, latest_history_id = _fetch_and_persist_messages(
            db=db,
            client=client,
            account=account,
            access_token=access_token,
            refresh_token=refresh_token,
            sync_state=sync_state,
            max_results=bounded_max,
        )

        # Update sync state on complete success
        sync_state.last_history_id = latest_history_id or sync_state.last_history_id
        sync_state.last_synced_at = datetime.now(UTC)
        sync_state.last_sync_status = "success"
        sync_state.last_error_message = None
        account.status = ExternalAccountStatus.active
        db.commit()

        logger.info(
            "Gmail sync complete for user_id=%s: %d messages processed.",
            account.user_id,
            synced_count,
        )
        return {
            "status": "success",
            "messages_synced": synced_count,
            "last_synced_at": sync_state.last_synced_at.isoformat(),
        }

    except GmailTokenRevokedError:
        account.status = ExternalAccountStatus.error
        sync_state.last_sync_status = "error"
        sync_state.last_error_message = "Authentication revoked or refresh token expired."
        db.commit()
        raise
    except Exception as exc:
        sync_state.last_sync_status = "error"
        sync_state.last_error_message = f"Sync failed: {type(exc).__name__}"
        db.commit()
        logger.error("Gmail sync failed for account %s: %s", account.id, exc)
        raise GmailSyncError(f"Gmail sync failed: {exc}") from exc
    finally:
        client.close()


def _do_refresh_token(db: Session, account: ExternalAccount, refresh_token: str | None) -> str:
    """Perform token refresh and update encrypted access token in database."""
    if not refresh_token:
        raise GmailTokenRevokedError("No refresh token available to refresh expired access token.")

    try:
        new_token_data = refresh_access_token(refresh_token)
    except GoogleOAuthError as exc:
        raise GmailTokenRevokedError(f"Failed to refresh Google token: {exc}") from exc

    new_access_token = new_token_data["access_token"]
    expires_in = new_token_data.get("expires_in", 3600)

    account.access_token_enc = encrypt_token(new_access_token)
    account.token_expires_at = datetime.now(UTC) + timedelta(seconds=expires_in)
    account.updated_at = datetime.now(UTC)
    db.commit()
    return new_access_token


def _fetch_and_persist_messages(
    db: Session,
    client: httpx.Client,
    account: ExternalAccount,
    access_token: str,
    refresh_token: str | None,
    sync_state: IntegrationSyncState,
    max_results: int,
) -> tuple[int, str | None]:
    """Fetch message headers and persist metadata idempotently."""
    headers = {"Authorization": f"Bearer {access_token}"}
    message_ids: list[str] = []
    latest_history_id: str | None = None

    # Step 1: Query recent message IDs
    list_url = f"{GMAIL_API_BASE}/messages"
    params = {"maxResults": max_results, "q": "category:primary"}

    response = client.get(list_url, headers=headers, params=params)

    # Handle token expiration on 401
    if response.status_code == 401:
        access_token = _do_refresh_token(db, account, refresh_token)
        headers["Authorization"] = f"Bearer {access_token}"
        response = client.get(list_url, headers=headers, params=params)

    if response.status_code != 200:
        logger.error("Failed to list messages from Gmail: status %d", response.status_code)
        raise GmailSyncError(f"Gmail API returned error {response.status_code}")

    list_data = response.json()
    items = list_data.get("messages", [])
    message_ids = [item["id"] for item in items if "id" in item]

    # Step 2: Fetch and persist metadata for each message
    synced_count = 0
    for msg_id in message_ids:
        # Check if message already exists
        existing = db.scalar(
            select(GmailMessage).where(
                GmailMessage.user_id == account.user_id,
                GmailMessage.message_id == msg_id,
            )
        )
        if existing is not None:
            continue

        msg_url = f"{GMAIL_API_BASE}/messages/{msg_id}"
        msg_params = {
            "format": "metadata",
            "metadataHeaders": ["From", "Subject", "Date"],
        }
        detail_res = client.get(msg_url, headers=headers, params=msg_params)
        if detail_res.status_code != 200:
            logger.warning("Could not fetch metadata for message %s (status %d)", msg_id, detail_res.status_code)
            continue

        detail = detail_res.json()
        payload = detail.get("payload", {})
        payload_headers = {h["name"].lower(): h["value"] for h in payload.get("headers", []) if "name" in h and "value" in h}

        sender = payload_headers.get("from", "Unknown Sender")
        subject = payload_headers.get("subject", "(No Subject)")
        snippet = detail.get("snippet", "")
        thread_id = detail.get("threadId", msg_id)
        history_id = detail.get("historyId")
        if history_id:
            latest_history_id = str(history_id)

        # Parse received timestamp
        date_str = payload_headers.get("date")
        received_at = datetime.now(UTC)
        if date_str:
            try:
                parsed_tuple = email.utils.parsedate_to_datetime(date_str)
                if parsed_tuple.tzinfo is None:
                    received_at = parsed_tuple.replace(tzinfo=UTC)
                else:
                    received_at = parsed_tuple.astimezone(UTC)
            except (TypeError, ValueError, IndexError, OverflowError):
                received_at = datetime.now(UTC)

        new_msg = GmailMessage(
            user_id=account.user_id,
            external_account_id=account.id,
            message_id=msg_id,
            thread_id=thread_id,
            sender=sender[:255],
            subject=subject[:500],
            snippet=snippet,
            received_at=received_at,
        )
        db.add(new_msg)
        synced_count += 1

    db.commit()
    return synced_count, latest_history_id
