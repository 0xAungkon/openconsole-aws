"""DB failures must surface as a clear 503, not an opaque 500."""

import pytest


@pytest.fixture
def client_without_schema():
    """TestClient whose DB has no tables (migrations never ran)."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool
    from starlette.testclient import TestClient

    from app.database import get_db
    from app.main import app

    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


def test_register_without_schema_returns_503_with_hint(client_without_schema):
    resp = client_without_schema.post(
        "/api/auth/register",
        json={"name": "T", "email": "t@example.com", "password": "secret123"},
    )
    assert resp.status_code == 503
    body = resp.json()
    assert body["code"] == "DatabaseError"
    assert "alembic upgrade head" in body["detail"]
    assert "no such table" in body["detail"]


def test_missing_encryption_key_returns_503_with_hint(client, monkeypatch):
    """Saving a profile without ENCRYPTION_KEY must explain the fix, not 500."""
    from app.utils import crypto

    monkeypatch.setattr(crypto.settings, "encryption_key", "")
    crypto._fernet.cache_clear()
    try:
        reg = client.post(
            "/api/auth/register",
            json={"name": "T", "email": "cfg@example.com", "password": "secret123"},
        )
        token = reg.json()["access_token"]
        resp = client.post(
            "/api/credentials",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "label": "p",
                "access_key_id": "test",
                "secret_access_key": "test",
                "default_region": "us-east-1",
            },
        )
    finally:
        crypto._fernet.cache_clear()
    assert resp.status_code == 503
    body = resp.json()
    assert body["code"] == "ConfigurationError"
    assert "ENCRYPTION_KEY is not set" in body["detail"]
