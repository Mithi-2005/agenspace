"""
OAuth state persistence and verification service.

This module provides state token generation and single-use consumption to prevent
Cross-Site Request Forgery (CSRF) and OAuth authorization injection attacks.

Security & Concurrency Guarantees
---------------------------------
1. Cryptographic Entropy:
   State tokens are generated using Python's `secrets.token_urlsafe(32)` (256 bits
   of cryptographic randomness).

2. Zero Raw Token Persistence:
   Raw state tokens are NEVER stored in the database or written to logs. Only
   the SHA-256 hash (computed via `app.core.security.hash_token`) is stored.

3. Atomic Single-Use Consumption:
   `validate_and_consume_state` executes `SELECT ... FOR UPDATE` row locking.
   Under PostgreSQL (and transactional databases), concurrent callbacks with the
   same state token serialize on the row lock. The first transaction marks `is_used = True`
   and commits. Subsequent transactions see `is_used == True` and are immediately
   rejected with `OAuthStateAlreadyUsedError`.

4. Fail-Closed Validation:
   Unknown, expired, already-consumed, or mismatched-provider states raise
   specific `OAuthStateError` exceptions with generic, safe messages that never
   leak token values or hashes.
"""

import logging
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_token
from app.models.oauth_state import OAuthState

logger = logging.getLogger("kosway.oauth.state")

DEFAULT_STATE_EXPIRY_SECONDS = 600  # 10 minutes


class OAuthStateError(ValueError):
    """Base exception for OAuth state validation errors."""


class OAuthStateNotFoundError(OAuthStateError):
    """Raised when the state token is unrecognized."""


class OAuthStateExpiredError(OAuthStateError):
    """Raised when the state token has expired."""


class OAuthStateAlreadyUsedError(OAuthStateError):
    """Raised when the state token has already been consumed."""


class OAuthStateProviderMismatchError(OAuthStateError):
    """Raised when the state token belongs to a different OAuth provider."""


class OAuthStateInvalidError(OAuthStateError):
    """Raised when the state token format is empty or invalid."""


def generate_oauth_state(
    db: Session,
    user_id: uuid.UUID,
    provider: str,
    expires_in_seconds: int = DEFAULT_STATE_EXPIRY_SECONDS,
    auto_commit: bool = True,
) -> str:
    """
    Generate a cryptographic state token, persist its SHA-256 digest, and return
    the raw token to the caller for inclusion in the OAuth authorization URL.

    Parameters
    ----------
    db : Session
        SQLAlchemy database session.
    user_id : uuid.UUID
        The authenticated Kosway user initiating the authorization flow.
    provider : str
        Provider identifier (e.g. 'google').
    expires_in_seconds : int
        Validity window in seconds (defaults to 600s / 10 minutes).
    auto_commit : bool
        Whether to commit the transaction immediately (default: True).

    Returns
    -------
    str
        The raw high-entropy state token to be passed to the external OAuth provider.
    """
    if not provider or not provider.strip():
        raise OAuthStateInvalidError("Provider must not be empty.")

    raw_state = secrets.token_urlsafe(32)
    state_hash = hash_token(raw_state)
    expires_at = datetime.now(UTC) + timedelta(seconds=expires_in_seconds)

    record = OAuthState(
        user_id=user_id,
        provider=provider.strip().lower(),
        state_hash=state_hash,
        expires_at=expires_at,
        is_used=False,
    )
    db.add(record)
    if auto_commit:
        db.commit()
        db.refresh(record)
    else:
        db.flush()

    logger.info("Generated OAuth state for user_id=%s, provider=%s", user_id, provider)
    return raw_state


def validate_and_consume_state(
    db: Session,
    raw_state: str,
    provider: str,
    auto_commit: bool = True,
) -> OAuthState:
    """
    Validate a callback state token and atomically mark it as consumed.

    Pessimistic row locking (`with_for_update()`) ensures single-use consumption
    under concurrent execution. The initiating user ID is securely recovered from
    the returned OAuthState object.

    Parameters
    ----------
    db : Session
        SQLAlchemy database session.
    raw_state : str
        The raw state token received in the OAuth provider callback.
    provider : str
        Expected provider identifier (e.g. 'google').
    auto_commit : bool
        Whether to commit the consumed status immediately (default: True).

    Returns
    -------
    OAuthState
        The consumed state record, containing the authentic `user_id`.

    Raises
    ------
    OAuthStateInvalidError
        If raw_state or provider is empty.
    OAuthStateNotFoundError
        If no matching state record exists.
    OAuthStateProviderMismatchError
        If the record was created for a different provider.
    OAuthStateAlreadyUsedError
        If the state token has already been consumed.
    OAuthStateExpiredError
        If the state token has expired.
    """
    if not raw_state or not raw_state.strip():
        raise OAuthStateInvalidError("OAuth state parameter is missing or empty.")
    if not provider or not provider.strip():
        raise OAuthStateInvalidError("Provider must not be empty.")

    normalized_provider = provider.strip().lower()
    state_hash = hash_token(raw_state)

    # Pessimistic row locking: blocks concurrent transactions until this one commits.
    state = db.scalar(
        select(OAuthState).where(OAuthState.state_hash == state_hash).with_for_update()
    )

    if state is None:
        logger.warning("OAuth state lookup failed: unknown state token.")
        raise OAuthStateNotFoundError("Invalid or unknown OAuth state.")

    if state.provider != normalized_provider:
        logger.warning(
            "OAuth state provider mismatch: expected=%s, got=%s",
            normalized_provider,
            state.provider,
        )
        raise OAuthStateProviderMismatchError("OAuth state provider mismatch.")

    if state.is_used:
        logger.warning("OAuth state replay detected: state was already consumed.")
        raise OAuthStateAlreadyUsedError("OAuth state has already been consumed.")

    now = datetime.now(UTC)
    if state.expires_at <= now:
        logger.warning("OAuth state expired at %s (now: %s).", state.expires_at, now)
        raise OAuthStateExpiredError("OAuth state has expired.")

    # Mark as consumed atomically
    state.is_used = True
    if auto_commit:
        db.commit()
        db.refresh(state)
    else:
        db.flush()

    logger.info(
        "Successfully consumed OAuth state for user_id=%s, provider=%s",
        state.user_id,
        state.provider,
    )
    return state
