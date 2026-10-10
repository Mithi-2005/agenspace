from fastapi.testclient import TestClient


def test_get_me_unauthenticated(client: TestClient) -> None:
    response = client.get("/api/v1/users/me")
    assert response.status_code == 401


def test_get_me_authenticated(client: TestClient) -> None:
    # Register & Login
    client.post(
        "/api/v1/auth/register",
        json={"email": "me@example.com", "display_name": "Me User", "password": "Password123!"},
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "me@example.com", "password": "Password123!"},
    )
    token = login_res.json()["access_token"]

    response = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "me@example.com"
    assert data["display_name"] == "Me User"


def test_update_me_profile(client: TestClient) -> None:
    client.post(
        "/api/v1/auth/register",
        json={"email": "update@example.com", "display_name": "Original Name", "password": "Password123!"},
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "update@example.com", "password": "Password123!"},
    )
    token = login_res.json()["access_token"]

    # Patch display_name
    patch_res = client.patch(
        "/api/v1/users/me",
        json={"display_name": "New Display Name"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["display_name"] == "New Display Name"

    # Verify retrieval
    get_res = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_res.json()["display_name"] == "New Display Name"


def test_update_me_validation_rejects_empty(client: TestClient) -> None:
    client.post(
        "/api/v1/auth/register",
        json={"email": "val@example.com", "display_name": "Original", "password": "Password123!"},
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "val@example.com", "password": "Password123!"},
    )
    token = login_res.json()["access_token"]

    patch_res = client.patch(
        "/api/v1/users/me",
        json={"display_name": "   "},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert patch_res.status_code == 422


def test_change_password_flow(client: TestClient) -> None:
    client.post(
        "/api/v1/auth/register",
        json={"email": "pwchange@example.com", "display_name": "User", "password": "OldPassword1!"},
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "pwchange@example.com", "password": "OldPassword1!"},
    )
    token = login_res.json()["access_token"]
    cookie = login_res.cookies.get("refresh_token")

    # Incorrect current password
    bad_res = client.post(
        "/api/v1/users/me/password",
        json={"current_password": "WrongPassword!", "new_password": "NewPassword1!"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert bad_res.status_code == 400
    assert "incorrect" in bad_res.json()["detail"].lower()

    # Successful change
    good_res = client.post(
        "/api/v1/users/me/password",
        json={"current_password": "OldPassword1!", "new_password": "NewPassword1!"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert good_res.status_code == 200

    # Active refresh sessions must now be revoked
    client.cookies.set("refresh_token", cookie)
    refresh_res = client.post("/api/v1/auth/refresh", headers={"Origin": "http://localhost:5173"})
    assert refresh_res.status_code == 401

    # Old password no longer logs in
    old_login = client.post(
        "/api/v1/auth/login",
        json={"email": "pwchange@example.com", "password": "OldPassword1!"},
    )
    assert old_login.status_code == 401

    # New password logs in successfully
    new_login = client.post(
        "/api/v1/auth/login",
        json={"email": "pwchange@example.com", "password": "NewPassword1!"},
    )
    assert new_login.status_code == 200


def test_user_isolation(client: TestClient) -> None:
    # User 1
    client.post(
        "/api/v1/auth/register",
        json={"email": "user1@example.com", "display_name": "User 1", "password": "Password123!"},
    )
    l1 = client.post(
        "/api/v1/auth/login",
        json={"email": "user1@example.com", "password": "Password123!"},
    )
    token1 = l1.json()["access_token"]

    # User 2
    client.post(
        "/api/v1/auth/register",
        json={"email": "user2@example.com", "display_name": "User 2", "password": "Password123!"},
    )
    l2 = client.post(
        "/api/v1/auth/login",
        json={"email": "user2@example.com", "password": "Password123!"},
    )
    token2 = l2.json()["access_token"]

    # Profile for token1 only returns User 1
    me1 = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token1}"}).json()
    assert me1["email"] == "user1@example.com"

    # Profile for token2 only returns User 2
    me2 = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token2}"}).json()
    assert me2["email"] == "user2@example.com"
    assert me1["id"] != me2["id"]
