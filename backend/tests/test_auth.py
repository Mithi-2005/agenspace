
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.user import User


def test_register_success(client: TestClient) -> None:
    payload = {
        "email": "Test.User@Example.Com",
        "display_name": "Test User",
        "password": "StrongPassword123!",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test.user@example.com"  # Normalized lowercase
    assert data["display_name"] == "Test User"
    assert data["is_active"] is True
    assert data["is_verified"] is False
    assert "password" not in data
    assert "password_hash" not in data
    assert "id" in data


def test_register_duplicate_email_rejected(client: TestClient) -> None:
    payload = {
        "email": "duplicate@example.com",
        "display_name": "First User",
        "password": "Password123!",
    }
    r1 = client.post("/api/v1/auth/register", json=payload)
    assert r1.status_code == 201

    # Attempt with different casing
    r2 = client.post(
        "/api/v1/auth/register",
        json={
            "email": "DUPLICATE@EXAMPLE.COM",
            "display_name": "Second User",
            "password": "Password456!",
        },
    )
    assert r2.status_code == 409
    assert "already exists" in r2.json()["detail"].lower()


def test_register_validation_errors(client: TestClient) -> None:
    # Short password
    r1 = client.post(
        "/api/v1/auth/register",
        json={"email": "valid@example.com", "display_name": "User", "password": "123"},
    )
    assert r1.status_code == 422

    # Empty display name
    r2 = client.post(
        "/api/v1/auth/register",
        json={"email": "valid@example.com", "display_name": "   ", "password": "Password123!"},
    )
    assert r2.status_code == 422

    # Malformed email
    r3 = client.post(
        "/api/v1/auth/register",
        json={"email": "not-an-email", "display_name": "User", "password": "Password123!"},
    )
    assert r3.status_code == 422


def test_login_success_and_cookie_attributes(client: TestClient) -> None:
    # Register first
    client.post(
        "/api/v1/auth/register",
        json={"email": "login@example.com", "display_name": "Login User", "password": "SecurePassword1!"},
    )

    # Login
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "LOGIN@example.com", "password": "SecurePassword1!"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "login@example.com"

    # Check cookies
    cookies = response.cookies
    assert "refresh_token" in cookies


def test_login_invalid_credentials_returns_generic_error(client: TestClient) -> None:
    client.post(
        "/api/v1/auth/register",
        json={"email": "login2@example.com", "display_name": "User", "password": "Password123!"},
    )

    # Wrong password
    r1 = client.post(
        "/api/v1/auth/login",
        json={"email": "login2@example.com", "password": "WrongPassword!"},
    )
    assert r1.status_code == 401
    assert r1.json()["detail"] == "Invalid email or password."

    # Non-existent email
    r2 = client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "Password123!"},
    )
    assert r2.status_code == 401
    assert r2.json()["detail"] == "Invalid email or password."


def test_login_disabled_account_rejected(client: TestClient, db_session: Session) -> None:
    user = User(
        email="disabled@example.com",
        display_name="Disabled User",
        password_hash=hash_password("Password123!"),
        is_active=False,
    )
    db_session.add(user)
    db_session.commit()

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "disabled@example.com", "password": "Password123!"},
    )
    assert response.status_code == 403
    assert "disabled" in response.json()["detail"].lower()


def test_refresh_token_rotation(client: TestClient) -> None:
    client.post(
        "/api/v1/auth/register",
        json={"email": "refresh@example.com", "display_name": "User", "password": "Password123!"},
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "refresh@example.com", "password": "Password123!"},
    )
    token1 = login_res.json()["access_token"]
    cookie1 = login_res.cookies.get("refresh_token")
    assert cookie1 is not None

    # Refresh
    client.cookies.set("refresh_token", cookie1)
    refresh_res = client.post(
        "/api/v1/auth/refresh",
        headers={"Origin": "http://localhost:5173"},
    )
    assert refresh_res.status_code == 200
    token2 = refresh_res.json()["access_token"]
    cookie2 = refresh_res.cookies.get("refresh_token")

    assert token1 != token2
    assert cookie1 != cookie2


def test_refresh_reuse_detection_revokes_family(client: TestClient) -> None:
    client.post(
        "/api/v1/auth/register",
        json={"email": "reuse@example.com", "display_name": "User", "password": "Password123!"},
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "reuse@example.com", "password": "Password123!"},
    )
    cookie1 = login_res.cookies.get("refresh_token")

    # Rotate to cookie2
    client.cookies.set("refresh_token", cookie1)
    rotate_res = client.post(
        "/api/v1/auth/refresh",
        headers={"Origin": "http://localhost:5173"},
    )
    assert rotate_res.status_code == 200
    cookie2 = rotate_res.cookies.get("refresh_token")

    # Now attacker or replay attempts to reuse cookie1!
    client.cookies.set("refresh_token", cookie1)
    reuse_res = client.post(
        "/api/v1/auth/refresh",
        headers={"Origin": "http://localhost:5173"},
    )
    assert reuse_res.status_code == 401

    # Legitimate user now attempts to use cookie2 - should ALSO be revoked!
    client.cookies.set("refresh_token", cookie2)
    legit_res = client.post(
        "/api/v1/auth/refresh",
        headers={"Origin": "http://localhost:5173"},
    )
    assert legit_res.status_code == 401


def test_logout_revokes_session(client: TestClient) -> None:
    client.post(
        "/api/v1/auth/register",
        json={"email": "logout@example.com", "display_name": "User", "password": "Password123!"},
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "logout@example.com", "password": "Password123!"},
    )
    cookie = login_res.cookies.get("refresh_token")

    # Logout
    client.cookies.set("refresh_token", cookie)
    logout_res = client.post(
        "/api/v1/auth/logout",
        headers={"Origin": "http://localhost:5173"},
    )
    assert logout_res.status_code == 200

    # Attempt to refresh with revoked cookie
    client.cookies.set("refresh_token", cookie)
    refresh_res = client.post(
        "/api/v1/auth/refresh",
        headers={"Origin": "http://localhost:5173"},
    )
    assert refresh_res.status_code == 401


def test_logout_all_revokes_all_sessions(client: TestClient) -> None:
    client.post(
        "/api/v1/auth/register",
        json={"email": "logoutall@example.com", "display_name": "User", "password": "Password123!"},
    )
    login1 = client.post(
        "/api/v1/auth/login",
        json={"email": "logoutall@example.com", "password": "Password123!"},
    )
    token1 = login1.json()["access_token"]
    cookie1 = login1.cookies.get("refresh_token")

    login2 = client.post(
        "/api/v1/auth/login",
        json={"email": "logoutall@example.com", "password": "Password123!"},
    )
    cookie2 = login2.cookies.get("refresh_token")

    # Call logout-all using token1
    res = client.post(
        "/api/v1/auth/logout-all",
        headers={
            "Authorization": f"Bearer {token1}",
            "Origin": "http://localhost:5173",
        },
    )
    assert res.status_code == 200

    # Try refreshing both sessions
    client.cookies.set("refresh_token", cookie1)
    r1 = client.post("/api/v1/auth/refresh", headers={"Origin": "http://localhost:5173"})
    assert r1.status_code == 401

    client.cookies.set("refresh_token", cookie2)
    r2 = client.post("/api/v1/auth/refresh", headers={"Origin": "http://localhost:5173"})
    assert r2.status_code == 401


def test_csrf_origin_check_blocks_disallowed_origin(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/refresh",
        headers={"Origin": "http://malicious-website.com"},
    )
    assert response.status_code == 403
    assert "Cross-origin request rejected" in response.json()["detail"]
