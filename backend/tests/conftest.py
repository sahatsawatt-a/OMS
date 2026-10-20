import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings
from app.db.session import get_db
from app.main import app
from app.models import Base
from app.seed import seed_menu, seed_tables

STAFF_KEY = "test-staff-key"


@pytest.fixture
def db_session():
    """A fresh in-memory database with the sample menu and tables for each test."""
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    with Session() as s:
        seed_tables(s)
        seed_menu(s)
        s.commit()

    def override():
        s = Session()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = override
    yield Session
    app.dependency_overrides.pop(get_db, None)
    engine.dispose()


@pytest.fixture
def settings(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "staff_api_key", STAFF_KEY)
    monkeypatch.setattr(s, "browser_check_key", "")
    monkeypatch.setattr(s, "stripe_secret_key", "")
    monkeypatch.setattr(s, "stripe_publishable_key", "")
    monkeypatch.setattr(s, "stripe_webhook_secret", "")
    monkeypatch.setattr(s, "demo_mode", True)
    return s


@pytest.fixture
def client(db_session, settings):
    return TestClient(app)


@pytest.fixture
def staff(client):
    client.headers["X-Staff-Key"] = STAFF_KEY
    return client


@pytest.fixture
def seated(staff):
    """Table 3 seated; returns the session token."""
    res = staff.post("/api/tables/t3/sessions", json={"guests": 4})
    assert res.status_code == 200
    return res.json()["token"]
