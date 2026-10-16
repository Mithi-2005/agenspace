import pytest
from cryptography.fernet import Fernet
from pydantic import SecretStr

from app.core.config import Settings
from app.integrations.crypto import decrypt_token, encrypt_token


@pytest.fixture
def valid_fernet_key() -> str:
    return Fernet.generate_key().decode("utf-8")


@pytest.fixture
def alternate_fernet_key() -> str:
    return Fernet.generate_key().decode("utf-8")


def test_encrypt_and_decrypt_roundtrip(
    monkeypatch: pytest.MonkeyPatch, valid_fernet_key: str
) -> None:
    test_settings = Settings(INTEGRATION_ENCRYPTION_KEY=SecretStr(valid_fernet_key))
    monkeypatch.setattr("app.integrations.crypto.get_settings", lambda: test_settings)

    test_tokens = [
        "ya29.a0AfH6SMBabc123xyz-refresh-token",
        "gho_16C7e42F292c6912E7710c838347Ae178B4a",
        "token_with_unicode_✓_🌟_🚀",
        '{"access_token": "xyz", "expires_in": 3600}',
    ]

    for token in test_tokens:
        encrypted = encrypt_token(token)
        assert isinstance(encrypted, bytes)
        assert encrypted != token.encode("utf-8")

        decrypted = decrypt_token(encrypted)
        assert decrypted == token


def test_encrypt_empty_plaintext_raises_runtime_error(
    monkeypatch: pytest.MonkeyPatch, valid_fernet_key: str
) -> None:
    test_settings = Settings(INTEGRATION_ENCRYPTION_KEY=SecretStr(valid_fernet_key))
    monkeypatch.setattr("app.integrations.crypto.get_settings", lambda: test_settings)

    with pytest.raises(RuntimeError, match="plaintext must not be empty"):
        encrypt_token("")


def test_decrypt_empty_ciphertext_raises_runtime_error(
    monkeypatch: pytest.MonkeyPatch, valid_fernet_key: str
) -> None:
    test_settings = Settings(INTEGRATION_ENCRYPTION_KEY=SecretStr(valid_fernet_key))
    monkeypatch.setattr("app.integrations.crypto.get_settings", lambda: test_settings)

    with pytest.raises(RuntimeError, match="ciphertext must not be empty"):
        decrypt_token(b"")


def test_missing_encryption_key_raises_runtime_error(monkeypatch: pytest.MonkeyPatch) -> None:
    test_settings = Settings(INTEGRATION_ENCRYPTION_KEY=None)
    monkeypatch.setattr("app.integrations.crypto.get_settings", lambda: test_settings)

    with pytest.raises(RuntimeError, match="INTEGRATION_ENCRYPTION_KEY is not configured"):
        encrypt_token("some-token")

    with pytest.raises(RuntimeError, match="INTEGRATION_ENCRYPTION_KEY is not configured"):
        decrypt_token(b"some-ciphertext")


def test_invalid_key_format_raises_runtime_error(monkeypatch: pytest.MonkeyPatch) -> None:
    test_settings = Settings(INTEGRATION_ENCRYPTION_KEY=SecretStr("not-a-valid-44-char-fernet-key"))
    monkeypatch.setattr("app.integrations.crypto.get_settings", lambda: test_settings)

    with pytest.raises(RuntimeError, match="not a valid Fernet key"):
        encrypt_token("some-token")


def test_tampered_ciphertext_raises_value_error(
    monkeypatch: pytest.MonkeyPatch, valid_fernet_key: str
) -> None:
    test_settings = Settings(INTEGRATION_ENCRYPTION_KEY=SecretStr(valid_fernet_key))
    monkeypatch.setattr("app.integrations.crypto.get_settings", lambda: test_settings)

    ciphertext = encrypt_token("confidential-token-value")
    # Tamper with the ciphertext by flipping bytes
    tampered = bytearray(ciphertext)
    tampered[-5] ^= 0xFF
    tampered_bytes = bytes(tampered)

    with pytest.raises(ValueError, match="decryption failed"):
        decrypt_token(tampered_bytes)


def test_decrypt_with_different_key_raises_value_error(
    monkeypatch: pytest.MonkeyPatch, valid_fernet_key: str, alternate_fernet_key: str
) -> None:
    settings_a = Settings(INTEGRATION_ENCRYPTION_KEY=SecretStr(valid_fernet_key))
    monkeypatch.setattr("app.integrations.crypto.get_settings", lambda: settings_a)
    ciphertext = encrypt_token("token-encrypted-with-key-a")

    settings_b = Settings(INTEGRATION_ENCRYPTION_KEY=SecretStr(alternate_fernet_key))
    monkeypatch.setattr("app.integrations.crypto.get_settings", lambda: settings_b)

    with pytest.raises(ValueError, match="decryption failed"):
        decrypt_token(ciphertext)


def test_integrations_configured_property() -> None:
    # Default settings (all None)
    s = Settings()
    assert s.google_client_id is None
    assert s.google_client_secret is None
    assert s.google_redirect_uri is None
    assert s.integration_encryption_key is None
    assert s.integrations_configured is False

    # Partial settings
    s_partial = Settings(
        GOOGLE_CLIENT_ID="test-client-id",
        GOOGLE_CLIENT_SECRET=SecretStr("test-client-secret"),
    )
    assert s_partial.integrations_configured is False

    # Complete settings
    s_complete = Settings(
        GOOGLE_CLIENT_ID="test-client-id",
        GOOGLE_CLIENT_SECRET=SecretStr("test-client-secret"),
        GOOGLE_REDIRECT_URI="http://localhost:8000/api/v1/integrations/google/callback",
        INTEGRATION_ENCRYPTION_KEY=SecretStr(Fernet.generate_key().decode("utf-8")),
    )
    assert s_complete.integrations_configured is True
