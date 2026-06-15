"""
Pytest shared fixtures for the Knowledge Assistant backend tests.

Architecture
------------
The container's environment already has DATABASE_URL pointing at Postgres.
We cannot change that before SQLAlchemy creates its module-level engine.

Strategy:
  1. Import only the SQLAlchemy Base + model metadata (no engine yet).
  2. Create our own SQLite in-memory engine.
  3. Monkey-patch `app.core.database` so all downstream imports
     (repositories, routers, main) use *our* engine/session.
  4. Only *then* import `app.main` to build the FastAPI app.

This guarantees all DB operations hit SQLite regardless of environment.
"""
import os
import sys
import tempfile

# Provide sensible test-only defaults BEFORE any app import.
# Some modules (config, security) read these at import time.
os.environ["JWT_SECRET"] = "test-secret-key"
os.environ["JWT_ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "60"
os.environ["OPENAI_API_KEY"] = "test-key"
os.environ["OPENAI_BASE_URL"] = "https://api.openai.com/v1"
os.environ["OPENAI_MODEL"] = "gpt-4o-mini"
os.environ["FRONTEND_ORIGIN"] = "http://localhost:3000"
_upload_dir = tempfile.mkdtemp()
os.environ["UPLOAD_DIR"] = _upload_dir
os.environ["MAX_UPLOAD_MB"] = "10"

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# ---------------------------------------------------------------------------
# Step 1: Import Base (no engine created yet at this import path).
# ---------------------------------------------------------------------------
from app.core.database import Base  # noqa: E402

# ---------------------------------------------------------------------------
# Step 2: Build our own SQLite in-memory engine.
#   StaticPool is CRITICAL: forces all connections to reuse the same
#   underlying SQLite connection so that tables created by create_all()
#   are visible to every subsequent session.
# ---------------------------------------------------------------------------
TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


# ---------------------------------------------------------------------------
# Step 3: Monkey-patch app.core.database *before* app.main is imported.
# ---------------------------------------------------------------------------
import app.core.database as _db_module  # noqa: E402

_db_module.engine = test_engine
_db_module.SessionLocal = TestingSessionLocal

def _override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

_db_module.get_db = _override_get_db

# ---------------------------------------------------------------------------
# Step 4: NOW import app.main so all routers bind to the patched session.
# ---------------------------------------------------------------------------
from app.main import app  # noqa: E402
from app.core.database import get_db  # noqa: E402  (we'll override this too)
from app.core.security import hash_password  # noqa: E402
from app.repositories import user_repo  # noqa: E402


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session", autouse=True)
def test_db():
    """Create all tables in SQLite in-memory DB for the whole session."""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="session")
def client(test_db):
    """FastAPI TestClient wired to the in-memory SQLite DB."""
    from fastapi.testclient import TestClient

    # Override FastAPI's get_db dependency
    app.dependency_overrides[get_db] = _override_get_db

    # Seed the admin user
    db = TestingSessionLocal()
    try:
        if user_repo.get_by_username(db, "admin") is None:
            user_repo.create_user(
                db,
                username="admin",
                password_hash=hash_password("admin123"),
                display_name="Admin",
            )
    finally:
        db.close()

    # raise_server_exceptions=True so test failures show real tracebacks
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c

    app.dependency_overrides.clear()


@pytest.fixture(scope="session")
def auth_headers(client):
    """Login as admin and return the Authorization Bearer header dict."""
    resp = client.post("/auth/login", json={"username": "admin", "password": "admin123"})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
