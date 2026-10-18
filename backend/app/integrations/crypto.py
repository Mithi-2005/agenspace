"""
Credential encryption utility for AgenSpace integrations.

This module provides two functions — ``encrypt_token`` and ``decrypt_token`` —
that wrap Fernet symmetric encryption for safe at-rest storage of OAuth access
and refresh tokens.

Design decisions
----------------
* **Fernet only** — no key derivation, no PKCE, no envelope encryption at this
  stage.  A single environment-supplied Fernet key is sufficient for the
  current single-server deployment.  Key rotation is handled by re-encrypting
  all credential rows (out of scope for Phase 3).

* **Fail-closed** — both functions raise ``RuntimeError`` immediately when the
  encryption key is absent or invalid.  They never fall back to storing
  plaintext, never generate a key automatically, and never log key material.

* **Provider-agnostic** — this module knows nothing about Google, Gmail, or
  any specific OAuth provider.  It operates on arbitrary byte strings.

* **No database access** — encryption and decryption happen in the service
  layer, before any persistence call.  Route handlers must never receive
  plaintext tokens, decrypted bytes, or the key itself.

Security notes
--------------
* Fernet tokens are authenticated (AES-128-CBC + HMAC-SHA256).  Tampering with
  a ciphertext will cause ``decrypt_token`` to raise ``InvalidToken``, not
  silently return garbage.

* The key is read from ``Settings.integration_encryption_key`` (a ``SecretStr``)
  and discarded after each call.  It is never stored on a module-level
  variable or logged.

* Neither function logs plaintext, ciphertext, or the key.  Error messages
  are deliberately generic so that key material cannot leak via exception
  detail strings.
"""

import logging

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings

logger = logging.getLogger("agenspace.integrations.crypto")

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def encrypt_token(plaintext: str) -> bytes:
    """Encrypt *plaintext* using the configured Fernet key.

    Parameters
    ----------
    plaintext:
        The raw token string to encrypt (e.g. a Google access token or
        refresh token).  Must not be empty.

    Returns
    -------
    bytes
        The Fernet-encrypted ciphertext.  Store this value in the database;
        never store the plaintext.

    Raises
    ------
    RuntimeError
        If ``INTEGRATION_ENCRYPTION_KEY`` is not configured, is not a valid
        Fernet key, or if *plaintext* is empty.
    """
    if not plaintext:
        raise RuntimeError("encrypt_token: plaintext must not be empty.")

    fernet = _get_fernet()
    return fernet.encrypt(plaintext.encode("utf-8"))


def decrypt_token(ciphertext: bytes) -> str:
    """Decrypt *ciphertext* using the configured Fernet key.

    Parameters
    ----------
    ciphertext:
        The raw bytes previously returned by ``encrypt_token``.  Must not be
        empty.

    Returns
    -------
    str
        The decrypted plaintext token string.

    Raises
    ------
    RuntimeError
        If ``INTEGRATION_ENCRYPTION_KEY`` is not configured, is not a valid
        Fernet key, or if *ciphertext* is empty.
    ValueError
        If *ciphertext* is corrupt, has been tampered with, or was encrypted
        with a different key (wraps ``cryptography.fernet.InvalidToken``).
    """
    if not ciphertext:
        raise RuntimeError("decrypt_token: ciphertext must not be empty.")

    fernet = _get_fernet()
    try:
        return fernet.decrypt(ciphertext).decode("utf-8")
    except InvalidToken as exc:
        # Do NOT include the ciphertext or key in the error message.
        raise ValueError(
            "decrypt_token: decryption failed — ciphertext is invalid, "
            "corrupt, or was encrypted with a different key."
        ) from exc


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _get_fernet() -> Fernet:
    """Resolve the configured Fernet instance.

    Called on every encrypt/decrypt call so that key rotation (by changing the
    environment variable and restarting) takes effect without a process reload.

    Raises
    ------
    RuntimeError
        If ``INTEGRATION_ENCRYPTION_KEY`` is absent or is not a valid Fernet
        key format (44-character url-safe base64 string).
    """
    settings = get_settings()

    if settings.integration_encryption_key is None:
        raise RuntimeError(
            "INTEGRATION_ENCRYPTION_KEY is not configured. "
            "Set this environment variable before using integration credential storage. "
            "Generate a key with: "
            'python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
        )

    raw_key = settings.integration_encryption_key.get_secret_value()

    try:
        return Fernet(raw_key.encode("utf-8"))
    except (ValueError, Exception) as exc:
        # Catch Fernet's own validation error.  Do NOT include the key value.
        raise RuntimeError(
            "INTEGRATION_ENCRYPTION_KEY is not a valid Fernet key. "
            "A valid key is exactly 44 characters of url-safe base64 "
            '(generate with: python -c "from cryptography.fernet import Fernet; '
            'print(Fernet.generate_key().decode())").'
        ) from exc
