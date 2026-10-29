import os

import pytest

# Configure test settings BEFORE app modules import their cached settings.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault(
    # A deterministic (valid) Fernet key for the crypto round-trip test.
    "ENCRYPTION_KEY",
    "FA5G2fRYX4nC13T83COEObUe28MBkJ9mkjqfrHzYK7o=",
)
os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")
# Never run the npm frontend build from the test suite — it would shell out to
# node and take tens of seconds per run.
os.environ.setdefault("AUTO_BUILD_FRONTEND", "false")


@pytest.fixture
def client():
    """A TestClient backed by a fresh in-memory schema, with get_db overridden
    to share a single connection so the schema persists across requests."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool
    from starlette.testclient import TestClient

    from app.database import Base, get_db
    from app.main import app

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
