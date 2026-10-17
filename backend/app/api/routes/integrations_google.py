"""
Google OAuth and Gmail integration routes.

Provides endpoints for initiating Google OAuth, browser callback processing,
connection status inspection, manual Gmail synchronization, and account disconnection.
"""

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.integrations.google.client import (
    GoogleConfigError,
    GoogleIdentityError,
    GoogleOAuthError,
    build_authorization_url,
    exchange_code_for_tokens,
    fetch_google_userinfo,
)
from app.integrations.google.mail_actions import (
    GmailActionError,
    archive_message,
    permanently_delete_message,
    send_message,
    trash_message,
)
from app.integrations.google.sync import (
    GmailSyncError,
    GmailTokenRevokedError,
    sync_gmail_for_account,
)
from app.models.external_account import ExternalAccountStatus
from app.models.integration import IntegrationSyncState
from app.models.user import User
from app.schemas.gmail import (
    GmailMessageActionRequest,
    GmailPermanentDeleteRequest,
    GmailSendRequest,
)
from app.schemas.integration import GoogleConnectionStatusResponse, GoogleSyncResponse
from app.services.external_account_service import (
    ExternalAccountConflictError,
    delete_external_account,
    get_external_account,
    upsert_external_account,
)
from app.services.oauth_state_service import (
    OAuthStateError,
    generate_oauth_state,
    validate_and_consume_state,
)

logger = logging.getLogger("kosway.api.integrations.google")
GMAIL_FULL_ACCESS_SCOPE = "https://mail.google.com/"

router = APIRouter()


def _active_gmail_account(db: Session, user_id: uuid.UUID):
    account = get_external_account(db, user_id, "google")
    if account is None or account.status != ExternalAccountStatus.active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account is not connected or active.",
        )
    return account


def _get_safe_frontend_redirect(subpath: str = "") -> str:
    """Return a safe frontend URL prefix restricted to configured CORS origins."""
    settings = get_settings()
    base = settings.cors_origins[0] if settings.cors_origins else "http://localhost:5173"
    return f"{base.rstrip('/')}/#{subpath}"


@router.get(
    "/authorize",
    summary="Generate Google OAuth authorization URL for the authenticated user",
)
def google_authorize(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, str]:
    """
    Generate a cryptographic single-use OAuth state token and construct the
    official Google OAuth authorization URL.
    """
    try:
        raw_state = generate_oauth_state(db, current_user.id, "google")
        auth_url = build_authorization_url(raw_state)
    except GoogleConfigError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    return {"authorization_url": auth_url}


@router.get(
    "/callback",
    summary="Handle Google OAuth browser callback and redirect to frontend",
    response_class=RedirectResponse,
)
def google_callback(
    db: Annotated[Session, Depends(get_db)],
    code: str | None = Query(None),
    state: str | None = Query(None),
    error: str | None = Query(None),
) -> RedirectResponse:
    """
    Process Google's OAuth callback.

    Validates and consumes state, exchanges code for credentials, links the Google account,
    and safely redirects to the frontend connections screen with status.
    """
    redirect_dest = _get_safe_frontend_redirect("/connections")

    if error:
        logger.warning("Google OAuth callback returned error parameter: %s", error)
        return RedirectResponse(f"{redirect_dest}?status=error&detail=access_denied")

    if not code or not state:
        logger.warning("Google OAuth callback missing required code or state parameter.")
        return RedirectResponse(f"{redirect_dest}?status=error&detail=missing_parameters")

    # 1. Validate and consume state atomically via row-locking
    try:
        state_record = validate_and_consume_state(db, raw_state=state, provider="google")
    except OAuthStateError as exc:
        logger.warning("OAuth state verification failed during callback: %s", exc)
        return RedirectResponse(f"{redirect_dest}?status=error&detail=invalid_or_expired_state")

    initiating_user_id = state_record.user_id

    # 2. Server-side code exchange
    try:
        tokens = exchange_code_for_tokens(code)
    except GoogleOAuthError as exc:
        logger.error("Token exchange failed during callback: %s", exc)
        return RedirectResponse(f"{redirect_dest}?status=error&detail=token_exchange_failed")

    # 3. Verify Google identity and extract stable sub identifier
    try:
        userinfo = fetch_google_userinfo(tokens["access_token"])
    except GoogleIdentityError as exc:
        logger.error("Userinfo retrieval failed during callback: %s", exc)
        return RedirectResponse(f"{redirect_dest}?status=error&detail=identity_verification_failed")

    google_sub = userinfo.get("sub")
    google_email = userinfo.get("email")

    if not google_sub:
        return RedirectResponse(f"{redirect_dest}?status=error&detail=missing_identity")

    # 4. Upsert external account with encryption and reconnection safety
    try:
        upsert_external_account(
            db=db,
            user_id=initiating_user_id,
            provider="google",
            provider_user_id=google_sub,
            access_token=tokens["access_token"],
            refresh_token=tokens.get("refresh_token"),
            email=google_email,
            scopes=tokens.get("scope"),
        )
    except ExternalAccountConflictError as exc:
        logger.warning("External account conflict for user %s: %s", initiating_user_id, exc)
        return RedirectResponse(f"{redirect_dest}?status=error&detail=account_conflict")
    except (SQLAlchemyError, RuntimeError, ValueError) as exc:
        logger.error("Unexpected error saving external account: %s", exc)
        return RedirectResponse(f"{redirect_dest}?status=error&detail=storage_failed")

    logger.info("Successfully connected Google account for user %s", initiating_user_id)
    return RedirectResponse(f"{redirect_dest}?status=connected&provider=google")


@router.get(
    "/status",
    response_model=GoogleConnectionStatusResponse,
    summary="Get Google integration connection status for current user",
)
def get_google_status(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> GoogleConnectionStatusResponse:
    """Retrieve connection and synchronization status for the user's Google account."""
    account = get_external_account(db, current_user.id, "google")
    if account is None:
        return GoogleConnectionStatusResponse(is_connected=False)

    sync_state = db.scalar(
        select(IntegrationSyncState).where(IntegrationSyncState.external_account_id == account.id)
    )

    return GoogleConnectionStatusResponse(
        is_connected=account.status == ExternalAccountStatus.active,
        email=account.email,
        status=account.status.value,
        last_synced_at=sync_state.last_synced_at if sync_state else None,
        last_sync_status=sync_state.last_sync_status if sync_state else None,
        last_error_message=sync_state.last_error_message if sync_state else None,
        reauthorization_required=GMAIL_FULL_ACCESS_SCOPE not in (account.scopes or "").split(),
    )


@router.post(
    "/sync",
    response_model=GoogleSyncResponse,
    summary="Trigger on-demand synchronization of Gmail messages",
)
def trigger_google_sync(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> GoogleSyncResponse:
    """Trigger bounded Gmail message sync and suggestion generation."""
    account = get_external_account(db, current_user.id, "google")
    if account is None or account.status != ExternalAccountStatus.active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account is not connected or active.",
        )

    try:
        sync_result = sync_gmail_for_account(db, account)
        suggestions_count = sync_result["suggestions_created"]
    except GmailTokenRevokedError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google authorization was revoked or expired. Please reconnect.",
        ) from exc
    except GmailSyncError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gmail synchronization failed: {exc}",
        ) from exc

    return GoogleSyncResponse(
        status=sync_result["status"],
        messages_synced=sync_result["messages_synced"],
        suggestions_created=suggestions_count,
        extraction_failures=sync_result["extraction_failures"],
        fetch_failures=sync_result["fetch_failures"],
        last_synced_at=sync_result["last_synced_at"],
    )


@router.post(
    "/retry-failed",
    response_model=GoogleSyncResponse,
    summary="Retry failed Gmail message extraction and retrieval",
)
def retry_failed_google_sync(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> GoogleSyncResponse:
    """Retry failed messages within the same bounded Gmail sync window."""
    account = get_external_account(db, current_user.id, "google")
    if account is None or account.status != ExternalAccountStatus.active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account is not connected or active.",
        )
    try:
        result = sync_gmail_for_account(db, account, retry_failed=True)
    except GmailTokenRevokedError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google authorization expired. Reconnect Google and try again.",
        ) from exc
    except GmailSyncError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Gmail retry could not be completed. Please try again.",
        ) from exc
    return GoogleSyncResponse(
        status=result["status"],
        messages_synced=result["messages_synced"],
        suggestions_created=result["suggestions_created"],
        extraction_failures=result["extraction_failures"],
        fetch_failures=result["fetch_failures"],
        last_synced_at=result["last_synced_at"],
    )


@router.post("/messages/send", status_code=status.HTTP_202_ACCEPTED)
def send_gmail_message(
    payload: GmailSendRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, str]:
    """Send one user-authored message after explicit frontend confirmation."""
    account = _active_gmail_account(db, current_user.id)
    try:
        send_message(
            account,
            recipient=payload.to,
            subject=payload.subject,
            body=payload.body,
            confirmed=payload.confirmed,
        )
        db.commit()
    except GmailActionError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return {"status": "sent"}


@router.post("/messages/{message_id}/archive")
def archive_gmail_message(
    message_id: str,
    payload: GmailMessageActionRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, str]:
    """Archive only the confirmed message from the user's connected mailbox."""
    account = _active_gmail_account(db, current_user.id)
    try:
        archive_message(account, message_id, payload.message_id_confirmation)
        db.commit()
    except GmailActionError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return {"status": "archived"}


@router.post("/messages/{message_id}/trash")
def trash_gmail_message(
    message_id: str,
    payload: GmailMessageActionRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, str]:
    """Move only the confirmed message from the user's connected mailbox to Trash."""
    account = _active_gmail_account(db, current_user.id)
    try:
        trash_message(account, message_id, payload.message_id_confirmation)
        db.commit()
    except GmailActionError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return {"status": "trashed"}


@router.delete("/messages/{message_id}/permanently")
def permanently_delete_gmail_message(
    message_id: str,
    payload: GmailPermanentDeleteRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, str]:
    """Permanently delete only when the caller confirms this exact target explicitly."""
    account = _active_gmail_account(db, current_user.id)
    try:
        permanently_delete_message(account, message_id, payload.confirmation_phrase)
        db.commit()
    except GmailActionError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return {"status": "permanently_deleted"}


@router.delete(
    "/disconnect",
    summary="Disconnect Google account and clean up raw sync metadata",
)
def disconnect_google(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, str]:
    """
    Disconnect Google integration.

    Removes raw synchronized email metadata and unaccepted suggestions, while preserving
    any user-confirmed tasks and events.
    """
    deleted = delete_external_account(db, current_user.id, "google")
    if not deleted:
        return {"status": "not_connected"}

    logger.info("Disconnected Google integration for user %s", current_user.id)
    return {"status": "disconnected"}
