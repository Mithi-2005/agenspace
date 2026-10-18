"""
External account persistence and token management service.

This module manages connected external accounts (such as Google OAuth) for AgenSpace users.

Security & Architecture Guarantees
----------------------------------
1. Token Encryption at Rest:
   OAuth access tokens and refresh tokens are encrypted using `app.integrations.crypto.encrypt_token`
   (authenticated Fernet encryption) before being persisted. Plaintext tokens are NEVER stored
   in the database or logged.

2. User Isolation & Foreign Key Cascades:
   Every query is strictly scoped by `(user_id, provider)`. Users can never access or modify
   another user's external credentials. Deleting a user automatically cascades to remove their
   external accounts.

3. Reconnection Safety:
   Google often omits the `refresh_token` on subsequent authorization flows unless consent is
   explicitly re-prompted. When reconnecting an existing account, `upsert_external_account`
   preserves the existing encrypted refresh token if the callback does not supply a replacement.

4. Account Identity Conflict Guard:
   If a user attempts to connect a Google account with a different `sub` (provider_user_id) than
   the currently connected account, an explicit `ExternalAccountConflictError` is raised rather
   than silently replacing the account.
"""

import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.integrations.crypto import decrypt_token, encrypt_token
from app.models.external_account import ExternalAccount, ExternalAccountStatus

logger = logging.getLogger("agenspace.integrations.external_account")


class ExternalAccountError(ValueError):
    """Base exception for external account operations."""


class ExternalAccountConflictError(ExternalAccountError):
    """Raised when an external account conflict occurs (e.g. mismatched provider user ID)."""


class ExternalAccountNotFoundError(ExternalAccountError):
    """Raised when an external account record is not found."""


def upsert_external_account(
    db: Session,
    user_id: uuid.UUID,
    provider: str,
    provider_user_id: str,
    access_token: str,
    refresh_token: str | None = None,
    token_expires_at: datetime | None = None,
    email: str | None = None,
    scopes: str | None = None,
    auto_commit: bool = True,
) -> ExternalAccount:
    """
    Connect or reconnect an external provider account for an AgenSpace user.

    Parameters
    ----------
    db : Session
        SQLAlchemy database session.
    user_id : uuid.UUID
        Authenticated AgenSpace user ID.
    provider : str
        Provider identifier (e.g. 'google').
    provider_user_id : str
        Stable external identifier from the provider (e.g. Google's `sub`).
    access_token : str
        Plaintext access token to encrypt and store.
    refresh_token : str | None
        Plaintext refresh token to encrypt and store. If None or empty during a
        reconnection, the existing encrypted refresh token is preserved.
    token_expires_at : datetime | None
        Access token expiration timestamp (UTC).
    email : str | None
        External account email address for display purposes.
    scopes : str | None
        Granted OAuth scopes string.
    auto_commit : bool
        Whether to commit changes immediately (default: True).

    Returns
    -------
    ExternalAccount
        The persisted external account record.

    Raises
    ------
    ExternalAccountConflictError
        If the account is already connected to another user, or if the reconnecting
        Google account has a different `sub` than the existing connection.
    ExternalAccountError
        If required parameters are invalid or encryption fails.
    """
    if not provider or not provider.strip():
        raise ExternalAccountError("Provider must not be empty.")
    if not provider_user_id or not provider_user_id.strip():
        raise ExternalAccountError("Provider user ID must not be empty.")
    if not access_token or not access_token.strip():
        raise ExternalAccountError("Access token must not be empty.")

    normalized_provider = provider.strip().lower()
    normalized_sub = provider_user_id.strip()

    # Encrypt the access token before taking database locks
    encrypted_access_token = encrypt_token(access_token)

    # Check for existing account for this (user_id, provider)
    existing_account = db.scalar(
        select(ExternalAccount)
        .where(
            ExternalAccount.user_id == user_id,
            ExternalAccount.provider == normalized_provider,
        )
        .with_for_update()
    )

    if existing_account is not None:
        # Reconnection guard: check if external identity matches
        if existing_account.provider_user_id != normalized_sub:
            logger.warning(
                "External account conflict for user_id=%s, provider=%s: "
                "attempted to link a different provider_user_id.",
                user_id,
                normalized_provider,
            )
            raise ExternalAccountConflictError(
                "Connected provider account identity does not match the currently linked account. "
                "Please disconnect the existing account before connecting a different account."
            )

        # Update access token
        existing_account.access_token_enc = encrypted_access_token
        existing_account.token_expires_at = token_expires_at

        # Preserve existing refresh token if Google omitted it on re-auth
        if refresh_token is not None and refresh_token.strip():
            existing_account.refresh_token_enc = encrypt_token(refresh_token.strip())

        if email is not None:
            existing_account.email = email.strip()
        if scopes is not None:
            existing_account.scopes = scopes.strip()

        existing_account.status = ExternalAccountStatus.active
        existing_account.updated_at = datetime.now(UTC)

        account = existing_account
        logger.info(
            "Updated existing external account for user_id=%s, provider=%s",
            user_id,
            normalized_provider,
        )
    else:
        # Ensure provider account is not already claimed by a different AgenSpace user
        other_user_account = db.scalar(
            select(ExternalAccount).where(
                ExternalAccount.provider == normalized_provider,
                ExternalAccount.provider_user_id == normalized_sub,
            )
        )
        if other_user_account is not None and other_user_account.user_id != user_id:
            logger.warning(
                "External account conflict: provider_user_id is already linked to user_id=%s",
                other_user_account.user_id,
            )
            raise ExternalAccountConflictError(
                "This external account is already connected to another user."
            )

        encrypted_refresh_token = (
            encrypt_token(refresh_token.strip())
            if (refresh_token is not None and refresh_token.strip())
            else None
        )

        account = ExternalAccount(
            user_id=user_id,
            provider=normalized_provider,
            provider_user_id=normalized_sub,
            email=email.strip() if email else None,
            access_token_enc=encrypted_access_token,
            refresh_token_enc=encrypted_refresh_token,
            token_expires_at=token_expires_at,
            scopes=scopes.strip() if scopes else None,
            status=ExternalAccountStatus.active,
        )
        db.add(account)
        logger.info(
            "Created new external account for user_id=%s, provider=%s",
            user_id,
            normalized_provider,
        )

    if auto_commit:
        db.commit()
        db.refresh(account)
    else:
        db.flush()

    return account


def get_external_account(
    db: Session,
    user_id: uuid.UUID,
    provider: str,
) -> ExternalAccount | None:
    """
    Retrieve an external account for a specific user and provider.

    Parameters
    ----------
    db : Session
        SQLAlchemy database session.
    user_id : uuid.UUID
        Authenticated AgenSpace user ID.
    provider : str
        Provider identifier (e.g. 'google').

    Returns
    -------
    ExternalAccount | None
        The account record if found, otherwise None.
    """
    return db.scalar(
        select(ExternalAccount).where(
            ExternalAccount.user_id == user_id,
            ExternalAccount.provider == provider.strip().lower(),
        )
    )


def get_decrypted_tokens(account: ExternalAccount) -> tuple[str, str | None]:
    """
    Decrypt and return the stored access token and optional refresh token.

    Security rule: This should only be called inside background worker / integration
    service boundaries immediately before communicating with external APIs.
    Never return decrypted tokens in API responses.

    Parameters
    ----------
    account : ExternalAccount
        The persisted external account record.

    Returns
    -------
    tuple[str, str | None]
        (access_token_plaintext, refresh_token_plaintext_or_none)
    """
    access_token = decrypt_token(account.access_token_enc)
    refresh_token = (
        decrypt_token(account.refresh_token_enc) if account.refresh_token_enc is not None else None
    )
    return access_token, refresh_token


def update_external_account_status(
    db: Session,
    user_id: uuid.UUID,
    provider: str,
    status: ExternalAccountStatus,
    auto_commit: bool = True,
) -> ExternalAccount:
    """
    Update the connection status of a user's external account (e.g. to revoked or error).

    Parameters
    ----------
    db : Session
        SQLAlchemy database session.
    user_id : uuid.UUID
        Authenticated AgenSpace user ID.
    provider : str
        Provider identifier.
    status : ExternalAccountStatus
        New connection status.
    auto_commit : bool
        Whether to commit changes immediately.

    Returns
    -------
    ExternalAccount
        The updated account record.

    Raises
    ------
    ExternalAccountNotFoundError
        If the account does not exist for the user.
    """
    account = get_external_account(db, user_id, provider)
    if account is None:
        raise ExternalAccountNotFoundError(f"External account for provider '{provider}' not found.")

    account.status = status
    account.updated_at = datetime.now(UTC)

    if auto_commit:
        db.commit()
        db.refresh(account)
    else:
        db.flush()

    logger.info(
        "Updated external account status to %s for user_id=%s, provider=%s",
        status.value,
        user_id,
        provider,
    )
    return account


def delete_external_account(
    db: Session,
    user_id: uuid.UUID,
    provider: str,
    auto_commit: bool = True,
) -> bool:
    """
    Disconnect and delete an external account for a user.

    Parameters
    ----------
    db : Session
        SQLAlchemy database session.
    user_id : uuid.UUID
        Authenticated AgenSpace user ID.
    provider : str
        Provider identifier.
    auto_commit : bool
        Whether to commit deletion immediately.

    Returns
    -------
    bool
        True if an account was deleted, False if no account was found.
    """
    account = get_external_account(db, user_id, provider)
    if account is None:
        return False

    db.delete(account)
    if auto_commit:
        db.commit()
    else:
        db.flush()

    logger.info("Deleted external account for user_id=%s, provider=%s", user_id, provider)
    return True
