"""
Gmail message synchronization engine.

Performs bounded, incremental synchronization of Gmail messages using Gmail's REST API.
Handles token expiration, history ID fallback, duplicate suppression, and minimal metadata storage.
"""

import base64
import email.utils
import hashlib
import html
import logging
import random
import re
import time
from datetime import UTC, datetime, timedelta
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.integrations.crypto import encrypt_token
from app.integrations.google.client import GoogleOAuthError, refresh_access_token
from app.integrations.google.suggestions import persist_extraction
from app.models.external_account import ExternalAccount, ExternalAccountStatus
from app.models.integration import GmailMessage, IntegrationSyncState
from app.models.user import User
from app.services.external_account_service import get_decrypted_tokens
from app.services.gmail_intelligence_service import GmailIntelligenceError, GmailIntelligenceService

logger = logging.getLogger("kosway.integrations.google.sync")

GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"
DEFAULT_BATCH_SIZE = 20
MAX_BATCH_SIZE = 50
GMAIL_RETRY_ATTEMPTS = 3


class GmailSyncError(Exception):
    """Base exception for Gmail synchronization errors."""


class GmailTokenRevokedError(GmailSyncError):
    """Raised when Gmail access is revoked or token cannot be refreshed."""


def sync_gmail_for_account(
    db: Session,
    account: ExternalAccount,
    max_results: int = DEFAULT_BATCH_SIZE,
    *,
    retry_failed: bool = False,
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
        select(IntegrationSyncState).where(IntegrationSyncState.external_account_id == account.id)
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
        (
            synced_count,
            latest_history_id,
            suggestions_created,
            extraction_failures,
            fetch_failures,
        ) = (
            _fetch_and_persist_messages(
                db=db,
                client=client,
                account=account,
                access_token=access_token,
                refresh_token=refresh_token,
                sync_state=sync_state,
                max_results=bounded_max,
                retry_failed=retry_failed,
            )
        )

        # Update sync state on complete success
        sync_state.last_history_id = latest_history_id or sync_state.last_history_id
        sync_state.last_synced_at = datetime.now(UTC)
        total_failures = extraction_failures + fetch_failures
        sync_state.last_sync_status = "partial" if total_failures else "success"
        sync_state.last_error_message = (
            f"{extraction_failures} message(s) could not be analyzed and "
            f"{fetch_failures} message(s) could not be fetched."
            if total_failures
            else None
        )
        account.status = ExternalAccountStatus.active
        db.commit()

        logger.info(
            "Gmail sync complete for user_id=%s: %d messages processed.",
            account.user_id,
            synced_count,
        )
        return {
            "status": "partial" if total_failures else "success",
            "messages_synced": synced_count,
            "suggestions_created": suggestions_created,
            "extraction_failures": extraction_failures,
            "fetch_failures": fetch_failures,
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
        logger.error("Gmail sync failed for account_id=%s error_type=%s", account.id, type(exc).__name__)
        raise GmailSyncError("Gmail synchronization could not be completed.") from exc
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
    retry_failed: bool = False,
) -> tuple[int, str | None, int, int, int]:
    """Fetch full message content, analyze transiently, and persist only metadata/hash."""
    headers = {"Authorization": f"Bearer {access_token}"}
    message_ids: list[str] = []
    latest_history_id: str | None = None

    # Step 1: Query recent message IDs
    list_url = f"{GMAIL_API_BASE}/messages"
    window_days = get_settings().gmail_sync_window_days
    page_size = min(20, max_results)
    params: dict[str, str | int] = {"maxResults": page_size, "q": f"newer_than:{window_days}d"}
    message_ids: list[str] = []
    page_token: str | None = None
    while len(message_ids) < max_results:
        if page_token:
            params["pageToken"] = page_token
        response = _google_request(client, "get", list_url, headers=headers, params=params)
        if response.status_code == 401:
            access_token = _do_refresh_token(db, account, refresh_token)
            headers["Authorization"] = f"Bearer {access_token}"
            response = _google_request(client, "get", list_url, headers=headers, params=params)
        if response.status_code != 200:
            logger.warning("Gmail message listing failed with HTTP %d", response.status_code)
            raise GmailSyncError(f"Gmail message listing failed with HTTP {response.status_code}.")
        try:
            list_data = response.json()
        except (ValueError, TypeError) as exc:
            raise GmailSyncError("Gmail returned an invalid message listing.") from exc
        if not isinstance(list_data, dict):
            raise GmailSyncError("Gmail returned an invalid message listing.")
        listed_items = list_data.get("messages") or []
        if not isinstance(listed_items, list):
            raise GmailSyncError("Gmail returned an invalid message list.")
        for item in listed_items:
            if isinstance(item, dict) and item.get("id"):
                message_ids.append(item["id"])
                if len(message_ids) >= max_results:
                    break
        page_token = list_data.get("nextPageToken")
        if not page_token or len(message_ids) >= max_results:
            break
        params["maxResults"] = min(page_size, max_results - len(message_ids))
    message_ids = list(dict.fromkeys(message_ids))

    # Step 2: Fetch and persist metadata for each message
    synced_count = 0
    suggestions_created = 0
    extraction_failures = 0
    fetch_failures = 0
    provider_quota_exhausted = False
    intelligence = GmailIntelligenceService()
    for message_index, msg_id in enumerate(message_ids):
        # Check if message already exists
        existing = db.scalar(
            select(GmailMessage).where(
                GmailMessage.user_id == account.user_id,
                GmailMessage.message_id == msg_id,
            )
        )
        if existing is not None and existing.content_hash:
            if existing.extraction_status == "complete":
                continue
            if existing.extraction_status == "failed" and not retry_failed:
                extraction_failures += 1
                continue
            if existing.extraction_status == "disabled" and not get_settings().ai_configured:
                extraction_failures += 1
                continue

        msg_url = f"{GMAIL_API_BASE}/messages/{msg_id}"
        msg_params = {
            "format": "full",
        }
        try:
            detail_res = _google_request(client, "get", msg_url, headers=headers, params=msg_params)
        except GmailSyncError:
            fetch_failures += len(message_ids) - message_index
            logger.warning("Gmail message fetch exhausted retries for message_id=%s", msg_id)
            break
        if detail_res.status_code == 401:
            access_token = _do_refresh_token(db, account, refresh_token)
            headers["Authorization"] = f"Bearer {access_token}"
            try:
                detail_res = _google_request(
                    client, "get", msg_url, headers=headers, params=msg_params
                )
            except GmailSyncError:
                fetch_failures += len(message_ids) - message_index
                logger.warning("Gmail message fetch exhausted retries for message_id=%s", msg_id)
                break
        if detail_res.status_code != 200:
            logger.warning(
                "Could not fetch Gmail message id=%s status=%d", msg_id, detail_res.status_code
            )
            if detail_res.status_code != 404:
                fetch_failures += 1
                if detail_res.status_code in (408, 429, 403) or detail_res.status_code >= 500:
                    fetch_failures += len(message_ids) - message_index - 1
                    break
            continue

        try:
            detail = detail_res.json()
        except (ValueError, TypeError):
            fetch_failures += 1
            logger.warning("Gmail returned malformed message data for message_id=%s", msg_id)
            continue
        payload = detail.get("payload", {})
        payload_headers = {
            h["name"].lower(): h["value"]
            for h in payload.get("headers", [])
            if "name" in h and "value" in h
        }

        sender = payload_headers.get("from", "Unknown Sender")
        recipient = payload_headers.get("to")
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
                received_at = _gmail_internal_date(detail.get("internalDate")) or datetime.now(UTC)
        else:
            received_at = _gmail_internal_date(detail.get("internalDate")) or datetime.now(UTC)

        body = _gmail_body_text(payload)[:20000]
        digest = hashlib.sha256(
            "\0".join((subject, sender, recipient or "", received_at.isoformat(), body)).encode(
                "utf-8"
            )
        ).hexdigest()
        if existing is None:
            msg = GmailMessage(
                user_id=account.user_id,
                external_account_id=account.id,
                message_id=msg_id,
                thread_id=thread_id,
                sender=sender[:255],
                recipient=(recipient or "")[:255] or None,
                subject=subject[:500],
                snippet=snippet[:2000],
                received_at=received_at,
            )
            db.add(msg)
            db.flush()
            synced_count += 1
        else:
            msg = existing
        if (
            existing is not None
            and msg.content_hash == digest
            and msg.extraction_status == "complete"
        ):
            continue
        msg.content_hash = digest
        msg.extraction_status = "pending"
        msg.extraction_error = None
        msg.sender = sender[:255]
        msg.recipient = (recipient or "")[:255] or None
        msg.subject = subject[:500]
        msg.snippet = snippet[:2000]
        msg.received_at = received_at
        db.commit()
        if not body.strip():
            msg.extraction_status = "complete"
            msg.extracted_at = datetime.now(UTC)
            db.commit()
            continue
        if provider_quota_exhausted:
            msg.extraction_status = "retryable_failure"
            msg.extraction_error = "AI provider rate limit reached; retry later."
            extraction_failures += 1
            db.commit()
            continue
        user = db.get(User, account.user_id)
        try:
            extraction = intelligence.extract(
                subject=msg.subject,
                sender=msg.sender,
                recipient=msg.recipient,
                body=body,
                sent_at=msg.received_at,
                timezone=user.timezone if user else None,
            )
            suggestions_created += persist_extraction(db, account.user_id, msg, extraction, digest)
            msg.extraction_status = "complete"
            msg.extracted_at = datetime.now(UTC)
            msg.extraction_error = None
        except GmailIntelligenceError as exc:
            msg.extraction_status = (
                "retryable_failure"
                if exc.retryable
                else "disabled"
                if "not configured" in str(exc)
                else "failed"
            )
            msg.extraction_error = str(exc)[:500]
            extraction_failures += 1
            provider_quota_exhausted = provider_quota_exhausted or exc.quota_exhausted
            logger.warning(
                "Gmail extraction failed message_id=%s retryable=%s", msg_id, exc.retryable
            )
        db.commit()

    return synced_count, latest_history_id, suggestions_created, extraction_failures, fetch_failures


def _google_request(
    client: httpx.Client,
    method: str,
    url: str,
    **kwargs: object,
) -> httpx.Response:
    """Make a bounded Gmail API request with retry handling for temporary failures."""
    for attempt in range(GMAIL_RETRY_ATTEMPTS + 1):
        try:
            response = getattr(client, method)(url, **kwargs)
        except (httpx.TimeoutException, httpx.NetworkError) as exc:
            if attempt >= GMAIL_RETRY_ATTEMPTS:
                raise GmailSyncError("Gmail API network request failed after retries.") from exc
            time.sleep(random.uniform(0, min(2**attempt, 8)))
            continue
        retryable = response.status_code in (408, 429) or response.status_code >= 500
        if response.status_code == 403:
            retryable = _google_error_reason(response) in {
                "rateLimitExceeded",
                "userRateLimitExceeded",
            }
        if not retryable or attempt >= GMAIL_RETRY_ATTEMPTS:
            return response
        delay = _retry_after(response.headers.get("Retry-After"))
        time.sleep(max(delay, random.uniform(0, min(2**attempt, 8))))
    raise GmailSyncError("Gmail API request failed after retries.")


def _retry_after(value: str | None) -> float:
    if not value:
        return 0.0
    try:
        return min(max(float(value), 0.0), 30.0)
    except ValueError:
        try:
            parsed = parsedate_to_datetime(value)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=UTC)
            return min(max((parsed - datetime.now(UTC)).total_seconds(), 0.0), 30.0)
        except (TypeError, ValueError, OverflowError):
            return 0.0


def _google_error_reason(response: httpx.Response) -> str | None:
    try:
        payload = response.json()
        errors = payload.get("error", {}).get("errors", [])
        if errors and isinstance(errors[0], dict):
            return errors[0].get("reason")
    except (AttributeError, IndexError, TypeError, ValueError):
        pass
    return None


class _HTMLText(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._hidden = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() in ("script", "style", "head"):
            self._hidden += 1

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in ("script", "style", "head") and self._hidden:
            self._hidden -= 1

    def handle_data(self, data: str) -> None:
        if not self._hidden:
            self.parts.append(data)


def _gmail_body_text(payload: dict) -> str:
    plain: list[str] = []
    html_parts: list[str] = []
    parts_seen = 0

    def visit(part: dict) -> None:
        nonlocal parts_seen
        parts_seen += 1
        if parts_seen > 40:
            return
        if part.get("filename"):
            return
        mime = (part.get("mimeType") or "").lower()
        encoded = (part.get("body") or {}).get("data")
        if encoded and mime in ("text/plain", "text/html"):
            try:
                encoded = encoded[:80000]
                raw = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
                decoded = raw.decode("utf-8", errors="replace")
                (plain if mime == "text/plain" else html_parts).append(decoded)
            except (ValueError, TypeError):
                logger.info("Ignoring malformed Gmail MIME part")
        for child in part.get("parts") or []:
            if isinstance(child, dict):
                visit(child)

    visit(payload)
    if plain:
        return "\n".join(plain)[:20000]
    if not html_parts:
        return ""
    parser = _HTMLText()
    parser.feed("\n".join(html_parts))
    return html.unescape(re.sub(r"[ \t]+", " ", " ".join(parser.parts)))[:20000]


def _gmail_internal_date(value: object) -> datetime | None:
    try:
        return datetime.fromtimestamp(int(value) / 1000, tz=UTC)
    except (TypeError, ValueError, OverflowError, OSError):
        return None
