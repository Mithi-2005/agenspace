"""Gmail plugin API routes mounted alongside the shared Google connection."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.external_account import ExternalAccountStatus
from app.models.user import User
from app.plugins.gmail.actions import (
    GmailActionError,
    archive_message,
    permanently_delete_message,
    send_message,
    trash_message,
)
from app.plugins.gmail.schemas import (
    GmailMessageActionRequest,
    GmailPermanentDeleteRequest,
    GmailSendRequest,
    GmailSyncResponse,
)
from app.plugins.gmail.sync import (
    GmailSyncError,
    GmailTokenRevokedError,
    sync_gmail_for_account,
)
from app.services.external_account_service import get_external_account

router = APIRouter()


def _active_gmail_account(db: Session, user_id: uuid.UUID):
    account = get_external_account(db, user_id, "google")
    if account is None or account.status != ExternalAccountStatus.active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account is not connected or active.",
        )
    return account


@router.post(
    "/sync",
    response_model=GmailSyncResponse,
    summary="Trigger on-demand synchronization of Gmail messages",
)
def trigger_google_sync(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> GmailSyncResponse:
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

    return GmailSyncResponse(
        status=sync_result["status"],
        messages_synced=sync_result["messages_synced"],
        suggestions_created=suggestions_count,
        extraction_failures=sync_result["extraction_failures"],
        fetch_failures=sync_result["fetch_failures"],
        last_synced_at=sync_result["last_synced_at"],
    )


@router.post(
    "/retry-failed",
    response_model=GmailSyncResponse,
    summary="Retry failed Gmail message extraction and retrieval",
)
def retry_failed_google_sync(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> GmailSyncResponse:
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
    return GmailSyncResponse(
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
