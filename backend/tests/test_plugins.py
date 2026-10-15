"""Tests for Plugins Marketplace API — catalogue discovery, lifecycle, and user isolation."""
from __future__ import annotations

from fastapi.testclient import TestClient


def _register_and_login(client: TestClient, email: str, password: str = "Password123!") -> dict:
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "display_name": "Plugin Tester", "password": password},
    )
    res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_list_plugins_unauthorized(client: TestClient) -> None:
    res = client.get("/api/v1/plugins")
    assert res.status_code == 401


def test_list_plugins_contains_core_catalogue(client: TestClient) -> None:
    headers = _register_and_login(client, "plugincat@example.com")
    res = client.get("/api/v1/plugins", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "categories" in data
    assert data["total"] >= 5

    plugin_ids = [p["id"] for p in data["items"]]
    required_ids = [
        "gmail",
        "google-classroom",
        "google-calendar",
        "github",
        "university-portal",
    ]
    for req_id in required_ids:
        assert req_id in plugin_ids, f"Required plugin {req_id} missing from catalogue"

    # All should initially be uninstalled
    for item in data["items"]:
        assert item["is_installed"] is False
        assert item["installed_at"] is None
        assert item["status"] == "planned"
        # Explicit distinction between listing, installation, connection, and sync
        assert item["lifecycle"]["listing"] == "available"
        assert item["lifecycle"]["installation"] == "not_installed"
        assert item["lifecycle"]["connection"] == "unavailable"
        assert item["lifecycle"]["synchronization"] == "never"
        assert item["lifecycle"]["runtime_capabilities"] == "planned"


def test_list_plugins_filter_category(client: TestClient) -> None:
    headers = _register_and_login(client, "plugincatfilter@example.com")
    
    # Filter by Communication
    res = client.get("/api/v1/plugins?category=Communication", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert all(p["category"] == "Communication" for p in data["items"])
    assert any(p["id"] == "gmail" for p in data["items"])

    # Filter by Education
    res = client.get("/api/v1/plugins?category=Education", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert all(p["category"] == "Education" for p in data["items"])
    assert any(p["id"] == "google-classroom" for p in data["items"])
    assert any(p["id"] == "university-portal" for p in data["items"])


def test_list_plugins_search(client: TestClient) -> None:
    headers = _register_and_login(client, "pluginsearch@example.com")

    # Search for GitHub
    res = client.get("/api/v1/plugins?search=GitHub", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert any(p["id"] == "github" for p in data["items"])
    assert all("github" in p["name"].lower() or "github" in p["description"].lower() for p in data["items"])

    # Search by keyword in description
    res = client.get("/api/v1/plugins?search=syllabus", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert any(p["id"] == "google-classroom" for p in data["items"])


def test_get_single_plugin(client: TestClient) -> None:
    headers = _register_and_login(client, "singleplugin@example.com")
    res = client.get("/api/v1/plugins/gmail", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == "gmail"
    assert data["name"] == "Gmail"
    assert data["publisher"]["name"] == "Google LLC"
    assert data["publisher"]["verified"] is True
    assert len(data["capabilities"]) >= 2
    assert len(data["permissions"]) >= 1
    assert "OAuth" in data["setup_requirements"]


def test_get_single_plugin_not_found(client: TestClient) -> None:
    headers = _register_and_login(client, "notfoundplugin@example.com")
    res = client.get("/api/v1/plugins/nonexistent-plugin", headers=headers)
    assert res.status_code == 404


def test_install_and_uninstall_lifecycle(client: TestClient) -> None:
    headers = _register_and_login(client, "installlifecycle@example.com")

    # Initially not installed
    res = client.get("/api/v1/plugins/github", headers=headers)
    assert res.status_code == 200
    assert res.json()["is_installed"] is False

    # Install
    install_res = client.post("/api/v1/plugins/github/install", headers=headers)
    assert install_res.status_code == 201
    install_data = install_res.json()
    assert install_data["plugin_id"] == "github"
    assert install_data["is_enabled"] is True

    # Check listing now shows installed
    res_after = client.get("/api/v1/plugins/github", headers=headers)
    assert res_after.status_code == 200
    data = res_after.json()
    assert data["is_installed"] is True
    assert data["installed_at"] is not None
    assert data["lifecycle"]["installation"] == "installed"
    # Note: connection is still unavailable (planned) — NOT conflated with installation
    assert data["lifecycle"]["connection"] == "unavailable"

    # Filter installed only
    installed_res = client.get("/api/v1/plugins?installed_only=true", headers=headers)
    assert installed_res.status_code == 200
    installed_items = installed_res.json()["items"]
    assert len(installed_items) == 1
    assert installed_items[0]["id"] == "github"

    # Uninstall
    del_res = client.delete("/api/v1/plugins/github", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "uninstalled"

    # Verify uninstalled
    res_final = client.get("/api/v1/plugins/github", headers=headers)
    assert res_final.status_code == 200
    assert res_final.json()["is_installed"] is False


def test_install_unknown_plugin_fails(client: TestClient) -> None:
    headers = _register_and_login(client, "unknowninstall@example.com")
    res = client.post("/api/v1/plugins/random-plugin/install", headers=headers)
    assert res.status_code == 404


def test_uninstall_noninstalled_plugin_fails(client: TestClient) -> None:
    headers = _register_and_login(client, "uninstallfail@example.com")
    res = client.delete("/api/v1/plugins/gmail", headers=headers)
    assert res.status_code == 404


def test_plugin_installation_user_isolation(client: TestClient) -> None:
    """Ensure user A installing a plugin does not affect user B's installation state."""
    h_alice = _register_and_login(client, "alice_plugin@example.com")
    h_bob = _register_and_login(client, "bob_plugin@example.com")

    # Alice installs Google Calendar
    res = client.post("/api/v1/plugins/google-calendar/install", headers=h_alice)
    assert res.status_code == 201

    # Alice sees it as installed
    alice_check = client.get("/api/v1/plugins/google-calendar", headers=h_alice)
    assert alice_check.json()["is_installed"] is True

    # Bob must see it as NOT installed
    bob_check = client.get("/api/v1/plugins/google-calendar", headers=h_bob)
    assert bob_check.json()["is_installed"] is False

    # Bob's installed-only list must be empty
    bob_list = client.get("/api/v1/plugins?installed_only=true", headers=h_bob)
    assert bob_list.json()["total"] == 0
