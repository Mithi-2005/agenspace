"""User-confirmed Gmail operations scoped to the authenticated connection."""

import base64
import logging
import re
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage
from urllib.parse import quote

import httpx

from app.integrations.crypto import encrypt_token
from app.integrations.google.client import GoogleOAuthError, refresh_access_token
from app.models.external_account import ExternalAccount
from app.services.external_account_service import get_decrypted_tokens

logger = logging.getLogger("kosway.integrations.google.mail_actions")
GMAIL_MESSAGES_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages"
MESSAGE_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,255}$")


class GmailActionError(Exception):
    """Safe error for explicit Gmail operations."""


def _access_token(account: ExternalAccount) -> tuple[str, str | None]:
    access_token, refresh_token = get_decrypted_tokens(account)
    if account.token_expires_at and account.token_expires_at <= datetime.now(UTC) + timedelta(seconds=60):
        access_token = _refresh(account, refresh_token)
    return access_token, refresh_token


def _refresh(account: ExternalAccount, refresh_token: str | None) -> str:
    if not refresh_token:
        raise GmailActionError("Google authorization expired. Reconnect Gmail to continue.")
    try:
        token_data = refresh_access_token(refresh_token)
    except GoogleOAuthError as exc:
        raise GmailActionError("Google authorization expired. Reconnect Gmail to continue.") from exc
    token = token_data["access_token"]
    account.access_token_enc = encrypt_token(token)
    account.token_expires_at = datetime.now(UTC) + timedelta(
        seconds=token_data.get("expires_in", 3600)
    )
    account.updated_at = datetime.now(UTC)
    return token


def _request(
    account: ExternalAccount,
    method: str,
    url: str,
    *,
    json: dict | None = None,
) -> httpx.Response:
    access_token, refresh_token = _access_token(account)
    for attempt in range(2):
        try:
            with httpx.Client(timeout=20.0) as client:
                request = getattr(client, method)
                kwargs = {"headers": {"Authorization": f"Bearer {access_token}"}}
                if json is not None:
                    kwargs["json"] = json
                response = request(url, **kwargs)
        except httpx.RequestError as exc:
            raise GmailActionError("Could not reach Gmail. Please try again.") from exc
        if response.status_code != 401 or attempt:
            return response
        access_token = _refresh(account, refresh_token)
    raise GmailActionError("Google authorization failed. Reconnect Gmail to continue.")


def _owned_message(account: ExternalAccount, message_id: str) -> None:
    if not MESSAGE_ID_PATTERN.fullmatch(message_id):
        raise GmailActionError("Invalid Gmail message ID.")
    response = _request(
        account,
        "get",
        f"{GMAIL_MESSAGES_URL}/{quote(message_id, safe='')}?format=metadata",
    )
    if response.status_code == 404:
        raise GmailActionError("Message was not found in the connected Gmail account.")
    if response.status_code in (401, 403):
        raise GmailActionError("Gmail permission is missing. Reconnect Google and grant the requested access.")
    if response.status_code != 200:
        logger.warning("Gmail ownership check failed with HTTP %d", response.status_code)
        raise GmailActionError("Could not verify the message in the connected Gmail account.")


def send_message(
    account: ExternalAccount,
    *,
    recipient: str,
    subject: str,
    body: str,
    confirmed: bool,
) -> None:
    if not confirmed:
        raise GmailActionError("Explicit confirmation is required before sending.")
    message = EmailMessage()
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(body)
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode("ascii").rstrip("=")
    response = _request(account, "post", f"{GMAIL_MESSAGES_URL}/send", json={"raw": raw})
    if response.status_code in (401, 403):
        raise GmailActionError("Gmail send permission is missing. Reconnect Google and grant access.")
    if response.status_code not in (200, 202):
        logger.warning("Gmail send failed with HTTP %d", response.status_code)
        raise GmailActionError("Gmail could not send this message. Review it and try again.")


def archive_message(account: ExternalAccount, message_id: str, confirmed_id: str) -> None:
    _require_target_confirmation(message_id, confirmed_id)
    _owned_message(account, message_id)
    response = _request(
        account,
        "post",
        f"{GMAIL_MESSAGES_URL}/{quote(message_id, safe='')}/modify",
        json={"removeLabelIds": ["INBOX"]},
    )
    _require_action_success(response, "archive")


def trash_message(account: ExternalAccount, message_id: str, confirmed_id: str) -> None:
    _require_target_confirmation(message_id, confirmed_id)
    _owned_message(account, message_id)
    response = _request(
        account,
        "post",
        f"{GMAIL_MESSAGES_URL}/{quote(message_id, safe='')}/trash",
    )
    _require_action_success(response, "move to trash")


def permanently_delete_message(account: ExternalAccount, message_id: str, phrase: str) -> None:
    expected = f"DELETE {message_id} PERMANENTLY"
    if phrase != expected:
        raise GmailActionError("Type the exact permanent-delete confirmation phrase to continue.")
    _owned_message(account, message_id)
    response = _request(
        account,
        "delete",
        f"{GMAIL_MESSAGES_URL}/{quote(message_id, safe='')}",
    )
    _require_action_success(response, "permanently delete")


def _require_target_confirmation(message_id: str, confirmed_id: str) -> None:
    if confirmed_id != message_id:
        raise GmailActionError("Confirmation must match the exact Gmail message ID.")


def _require_action_success(response: httpx.Response, action: str) -> None:
    if response.status_code in (401, 403):
        raise GmailActionError("Gmail modification permission is missing. Reconnect Google to continue.")
    if response.status_code not in (200, 204):
        logger.warning("Gmail action failed with HTTP %d", response.status_code)
        raise GmailActionError(f"Could not {action} the message. Review permissions and try again.")
