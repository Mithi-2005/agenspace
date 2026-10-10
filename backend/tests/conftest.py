from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.core.rate_limiter import rate_limiter
from app.db.session import get_db
from app.main import app

settings = get_settings()
test_engine = create_engine(settings.database_url, pool_pre_ping=True)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, expire_on_commit=False)


@pytest.fixture(autouse=True)
def reset_limiter() -> None:
    """Reset rate limiter before each test to prevent cross-test interference."""
    rate_limiter.reset()


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """
    Provide a transaction-isolated database session.
    Rolls back transaction at test teardown so no test data persists.
    """
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    # Begin a nested transaction (savepoint)
    nested = connection.begin_nested()

    @pytest.fixture(autouse=True)
    def restart_savepoint() -> None:
        nonlocal nested
        if not nested.is_active:
            nested = connection.begin_nested()

    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """TestClient wired with transaction-isolated database session."""
    app.dependency_overrides[get_db] = lambda: db_session
    try:
        with TestClient(app, base_url="http://localhost:5173") as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
