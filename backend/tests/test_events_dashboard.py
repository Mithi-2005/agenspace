"""Tests for Events and Dashboard APIs."""
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


VALID_EVENT = {
    "title": "Team standup",
    "starts_at": "2027-01-15T09:00:00+00:00",
    "ends_at": "2027-01-15T09:30:00+00:00",
    "location": "Conference room B",
}


def test_create_event(client: TestClient) -> None:
    headers = _register_and_login(client, "eventuser@example.com")
    res = client.post("/api/v1/events", json=VALID_EVENT, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Team standup"
    assert data["location"] == "Conference room B"
    assert data["source"] == "user"


def test_list_events_empty(client: TestClient) -> None:
    headers = _register_and_login(client, "eventlist@example.com")
    res = client.get("/api/v1/events", headers=headers)
    assert res.status_code == 200
    assert res.json()["total"] == 0


def test_list_events_user_scoped(client: TestClient) -> None:
    h1 = _register_and_login(client, "evowner@example.com")
    h2 = _register_and_login(client, "evother@example.com")

    client.post("/api/v1/events", json=VALID_EVENT, headers=h1)
    client.post("/api/v1/events", json=VALID_EVENT, headers=h2)

    res = client.get("/api/v1/events", headers=h1)
    assert res.json()["total"] == 1


def test_get_event(client: TestClient) -> None:
    headers = _register_and_login(client, "getev@example.com")
    created = client.post("/api/v1/events", json=VALID_EVENT, headers=headers).json()

    res = client.get(f"/api/v1/events/{created['id']}", headers=headers)
    assert res.status_code == 200
    assert res.json()["id"] == created["id"]


def test_update_event(client: TestClient) -> None:
    headers = _register_and_login(client, "updev@example.com")
    created = client.post("/api/v1/events", json=VALID_EVENT, headers=headers).json()

    res = client.patch(
        f"/api/v1/events/{created['id']}",
        json={"title": "Updated standup"},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["title"] == "Updated standup"


def test_delete_event(client: TestClient) -> None:
    headers = _register_and_login(client, "delev@example.com")
    created = client.post("/api/v1/events", json=VALID_EVENT, headers=headers).json()

    assert client.delete(f"/api/v1/events/{created['id']}", headers=headers).status_code == 204
    assert client.get(f"/api/v1/events/{created['id']}", headers=headers).status_code == 404


def test_event_invalid_date_range(client: TestClient) -> None:
    headers = _register_and_login(client, "invalidevent@example.com")
    bad_event = {
        "title": "Bad event",
        "starts_at": "2027-01-15T10:00:00+00:00",
        "ends_at": "2027-01-15T09:00:00+00:00",  # ends before starts
    }
    res = client.post("/api/v1/events", json=bad_event, headers=headers)
    assert res.status_code == 422


def test_cross_user_event_access_denied(client: TestClient) -> None:
    h1 = _register_and_login(client, "cuevowner@example.com")
    h2 = _register_and_login(client, "cuevattacker@example.com")

    event = client.post("/api/v1/events", json=VALID_EVENT, headers=h1).json()
    assert client.get(f"/api/v1/events/{event['id']}", headers=h2).status_code == 404
    assert client.delete(f"/api/v1/events/{event['id']}", headers=h2).status_code == 404


def test_event_requires_authentication(client: TestClient) -> None:
    assert client.get("/api/v1/events").status_code == 401


def test_dashboard_requires_authentication(client: TestClient) -> None:
    assert client.get("/api/v1/dashboard").status_code == 401


def test_dashboard_returns_zero_counts_initially(client: TestClient) -> None:
    headers = _register_and_login(client, "dashzero@example.com")
    res = client.get("/api/v1/dashboard", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["tasks_open"] == 0
    assert data["tasks_due_today"] == 0
    assert data["tasks_overdue"] == 0
    assert data["tasks_completed"] == 0
    assert data["today_tasks"] == []
    assert data["upcoming_events"] == []


def test_dashboard_counts_after_tasks(client: TestClient) -> None:
    headers = _register_and_login(client, "dashcounts@example.com")

    # Create 2 open tasks
    client.post("/api/v1/tasks", json={"title": "Task A"}, headers=headers)
    t = client.post("/api/v1/tasks", json={"title": "Task B"}, headers=headers).json()
    # Complete one
    client.post(f"/api/v1/tasks/{t['id']}/complete", headers=headers)

    res = client.get("/api/v1/dashboard", headers=headers)
    data = res.json()
    assert data["tasks_open"] == 1
    assert data["tasks_completed"] == 1
