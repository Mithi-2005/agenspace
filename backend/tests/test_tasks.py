"""Tests for Tasks CRUD API — authentication and user isolation."""
from __future__ import annotations

from fastapi.testclient import TestClient


def _register_and_login(client: TestClient, email: str, password: str = "Password123!") -> dict:
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "display_name": "Test User", "password": password},
    )
    res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_create_task(client: TestClient) -> None:
    headers = _register_and_login(client, "taskuser@example.com")
    res = client.post(
        "/api/v1/tasks",
        json={"title": "Buy groceries", "priority": "high"},
        headers=headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Buy groceries"
    assert data["priority"] == "high"
    assert data["status"] == "open"
    assert data["completed_at"] is None


def test_list_tasks_initially_empty(client: TestClient) -> None:
    headers = _register_and_login(client, "tasklist@example.com")
    res = client.get("/api/v1/tasks", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 0
    assert data["items"] == []


def test_list_tasks_returns_only_own_tasks(client: TestClient) -> None:
    h1 = _register_and_login(client, "owner@example.com")
    h2 = _register_and_login(client, "other@example.com")

    client.post("/api/v1/tasks", json={"title": "Owner task"}, headers=h1)
    client.post("/api/v1/tasks", json={"title": "Other task"}, headers=h2)

    res = client.get("/api/v1/tasks", headers=h1)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["items"][0]["title"] == "Owner task"


def test_get_task(client: TestClient) -> None:
    headers = _register_and_login(client, "getask@example.com")
    created = client.post(
        "/api/v1/tasks", json={"title": "Read a book"}, headers=headers
    ).json()
    task_id = created["id"]

    res = client.get(f"/api/v1/tasks/{task_id}", headers=headers)
    assert res.status_code == 200
    assert res.json()["id"] == task_id


def test_get_task_not_found(client: TestClient) -> None:
    headers = _register_and_login(client, "tasknotfound@example.com")
    res = client.get(
        "/api/v1/tasks/00000000-0000-0000-0000-000000000099", headers=headers
    )
    assert res.status_code == 404


def test_update_task(client: TestClient) -> None:
    headers = _register_and_login(client, "updatetask@example.com")
    created = client.post(
        "/api/v1/tasks", json={"title": "Initial title"}, headers=headers
    ).json()

    res = client.patch(
        f"/api/v1/tasks/{created['id']}",
        json={"title": "Updated title", "priority": "medium"},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "Updated title"
    assert data["priority"] == "medium"


def test_complete_task(client: TestClient) -> None:
    headers = _register_and_login(client, "completetask@example.com")
    created = client.post(
        "/api/v1/tasks", json={"title": "Task to complete"}, headers=headers
    ).json()

    res = client.post(
        f"/api/v1/tasks/{created['id']}/complete", headers=headers
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "completed"
    assert data["completed_at"] is not None


def test_reopen_task(client: TestClient) -> None:
    headers = _register_and_login(client, "reopentask@example.com")
    created = client.post(
        "/api/v1/tasks", json={"title": "Task to reopen"}, headers=headers
    ).json()
    client.post(f"/api/v1/tasks/{created['id']}/complete", headers=headers)

    res = client.post(f"/api/v1/tasks/{created['id']}/reopen", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "open"
    assert data["completed_at"] is None


def test_delete_task(client: TestClient) -> None:
    headers = _register_and_login(client, "deletetask@example.com")
    created = client.post(
        "/api/v1/tasks", json={"title": "Task to delete"}, headers=headers
    ).json()

    res = client.delete(f"/api/v1/tasks/{created['id']}", headers=headers)
    assert res.status_code == 204

    # Should no longer exist
    res2 = client.get(f"/api/v1/tasks/{created['id']}", headers=headers)
    assert res2.status_code == 404


def test_cross_user_task_access_denied(client: TestClient) -> None:
    h1 = _register_and_login(client, "cu_task_owner@example.com")
    h2 = _register_and_login(client, "cu_task_attacker@example.com")

    task = client.post("/api/v1/tasks", json={"title": "Private"}, headers=h1).json()

    # Attacker tries to read, update, delete owner's task
    assert client.get(f"/api/v1/tasks/{task['id']}", headers=h2).status_code == 404
    assert client.patch(
        f"/api/v1/tasks/{task['id']}", json={"title": "Stolen"}, headers=h2
    ).status_code == 404
    assert client.delete(f"/api/v1/tasks/{task['id']}", headers=h2).status_code == 404


def test_task_requires_authentication(client: TestClient) -> None:
    res = client.get("/api/v1/tasks")
    assert res.status_code == 401


def test_task_filter_by_status(client: TestClient) -> None:
    headers = _register_and_login(client, "filterstatus@example.com")
    task = client.post("/api/v1/tasks", json={"title": "Filter test"}, headers=headers).json()
    client.post(f"/api/v1/tasks/{task['id']}/complete", headers=headers)

    open_res = client.get("/api/v1/tasks?status=open", headers=headers)
    assert open_res.json()["total"] == 0

    done_res = client.get("/api/v1/tasks?status=completed", headers=headers)
    assert done_res.json()["total"] == 1


def test_task_validation_empty_title(client: TestClient) -> None:
    headers = _register_and_login(client, "validationtask@example.com")
    res = client.post("/api/v1/tasks", json={"title": "   "}, headers=headers)
    assert res.status_code == 422
