import uuid
from datetime import timedelta

import jwt
import pytest
from fastapi import HTTPException

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    generate_opaque_refresh_token,
    hash_password,
    hash_token,
    verify_password,
)


def test_password_hashing_and_verification() -> None:
    password = "SuperSecretPassword99!"
    hashed = hash_password(password)

    # Argon2id prefix check
    assert hashed.startswith("$argon2id$")
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False
    assert verify_password(password, "invalid-hash-string") is False


def test_access_token_creation_and_claims() -> None:
    settings = get_settings()
    user_id = uuid.uuid4()
    token, expires_in = create_access_token(user_id)

    assert expires_in == settings.access_token_expire_minutes * 60

    payload = decode_access_token(token)
    assert payload["sub"] == str(user_id)
    assert payload["type"] == "access"
    assert payload["iss"] == settings.app_name
    assert payload["aud"] == f"{settings.app_name}-api"
    assert "jti" in payload


def test_access_token_expired_raises_401() -> None:
    user_id = uuid.uuid4()
    token, _ = create_access_token(user_id, expires_delta=timedelta(seconds=-10))

    with pytest.raises(HTTPException) as exc_info:
        decode_access_token(token)
    assert exc_info.value.status_code == 401
    assert "expired" in exc_info.value.detail.lower()


def test_access_token_wrong_type_rejected() -> None:
    settings = get_settings()
    user_id = uuid.uuid4()
    # Manually craft token with wrong type
    bad_token = jwt.encode(
        {
            "sub": str(user_id),
            "type": "refresh",
            "iss": settings.app_name,
            "aud": f"{settings.app_name}-api",
            "iat": 1000,
            "exp": 9999999999,
        },
        settings.secret_key.get_secret_value(),
        algorithm=settings.jwt_algorithm,
    )

    with pytest.raises(HTTPException) as exc_info:
        decode_access_token(bad_token)
    assert exc_info.value.status_code == 401
    assert "expected access token" in exc_info.value.detail.lower()


def test_opaque_refresh_token_generation_and_hashing() -> None:
    token1 = generate_opaque_refresh_token()
    token2 = generate_opaque_refresh_token()

    assert token1 != token2
    assert len(token1) >= 64

    hash1 = hash_token(token1)
    hash2 = hash_token(token2)
    assert hash1 != hash2
    assert len(hash1) == 64  # SHA-256 hex length
