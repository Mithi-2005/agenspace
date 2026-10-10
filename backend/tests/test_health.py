from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.db.session import get_db
from app.main import app

client = TestClient(app)


def test_health_returns_ok() -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_checks_database() -> None:
    db = Mock()
    app.dependency_overrides[get_db] = lambda: db
    try:
        response = client.get("/api/v1/ready")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"status": "ready", "checks": {"database": "ok"}}
    db.execute.assert_called_once()


def test_ready_returns_503_when_database_fails() -> None:
    db = Mock()
    db.execute.side_effect = OperationalError("SELECT 1", {}, Exception("connection refused"))
    app.dependency_overrides[get_db] = lambda: db
    try:
        response = client.get("/api/v1/ready")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 503
    assert response.json() == {
        "detail": {"status": "not_ready", "checks": {"database": "unavailable"}}
    }


def test_database_session_is_closed_after_use(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.db.session as session_module

    db = Mock()
    monkeypatch.setattr(session_module, "SessionLocal", Mock(return_value=db))

    dependency = get_db()
    assert next(dependency) is db
    dependency.close()

    db.close.assert_called_once()


def test_liveness_does_not_require_database() -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
