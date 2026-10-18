"""
Shared Google OAuth and account connection routes.

Provides endpoints for initiating Google OAuth, browser callback processing,
connection status inspection, and account disconnection. Plugin functionality lives
under `app.plugins` and mounts its routes alongside this connection router.
"""

import logging
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
from app.models.external_account import ExternalAccountStatus
from app.models.integration import IntegrationSyncState
from app.models.user import User
from app.schemas.integration import GoogleConnectionStatusResponse
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

logger = logging.getLogger("agenspace.api.integrations.google")
GMAIL_FULL_ACCESS_SCOPE = "https://mail.google.com/"

router = APIRouter()


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
