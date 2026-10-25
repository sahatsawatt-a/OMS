import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
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

    # Enforce foreign keys like MySQL does; SQLite skips them unless asked
    @event.listens_for(engine, "connect")
    def _foreign_keys(dbapi_connection, _record):
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

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
    monkeypatch.setattr(s, "admin_api_key", "")
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
    """Table 3 seated; returns the session as staff see it (id, QR token, ...)."""
    res = staff.post("/api/tables/t3/sessions", json={"guests": 4})
    assert res.status_code == 200
    return res.json()


class Phone:
    """A guest's phone: joined a table with the QR token, then sends its own device token."""

    def __init__(self, client, session_token, device_token=None):
        headers = {"X-Session-Token": session_token}
        if device_token:
            headers["X-Device-Token"] = device_token
        res = client.post("/api/guest/join", headers=headers)
        assert res.status_code == 200, res.text
        self.client = client
        self.token = res.json()["deviceToken"]
        self.label = res.json()["label"]

    def _headers(self, kwargs):
        return {**kwargs.pop("headers", {}), "X-Device-Token": self.token}

    def get(self, path, **kwargs):
        return self.client.get(path, headers=self._headers(kwargs), **kwargs)

    def post(self, path, **kwargs):
        return self.client.post(path, headers=self._headers(kwargs), **kwargs)

    def state(self):
        return self.get("/api/guest/state").json()

    def order(self, lines, pay="counter"):
        return self.post("/api/guest/orders", json={"lines": lines, "pay": pay})


@pytest.fixture
def phone(client, seated):
    """The first phone at table 3 (A)."""
    return Phone(client, seated["token"])
