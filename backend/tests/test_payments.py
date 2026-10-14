from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

client = TestClient(app)


def create_intent(amount: int, table_number: int = 3):
    body = {"amount": amount, "table_number": table_number, "session_token": "abcdefgh"}
    return client.post("/api/payments/intents", json=body)


@pytest.fixture
def stripe_keys(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_dummy")
    monkeypatch.setattr(settings, "stripe_publishable_key", "pk_test_dummy")


@pytest.fixture
def no_stripe_keys(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "stripe_secret_key", "")
    monkeypatch.setattr(settings, "stripe_publishable_key", "")


def test_config_disabled_without_keys(no_stripe_keys):
    assert client.get("/api/payments/config").json() == {"enabled": False, "publishable_key": ""}


def test_config_exposes_only_publishable_key(stripe_keys):
    body = client.get("/api/payments/config").json()
    assert body == {"enabled": True, "publishable_key": "pk_test_dummy"}


def test_create_intent_requires_keys(no_stripe_keys):
    res = create_intent(5000)
    assert res.status_code == 503


def test_create_intent_rejects_amount_below_stripe_minimum(stripe_keys):
    res = create_intent(500)
    assert res.status_code == 422


def test_create_intent_calls_stripe_in_thb(stripe_keys, monkeypatch):
    calls = {}

    def fake_create(**kwargs):
        calls.update(kwargs)
        return SimpleNamespace(id="pi_123", client_secret="pi_123_secret_abc")

    monkeypatch.setattr("stripe.PaymentIntent.create", fake_create)
    res = create_intent(51553, table_number=2)
    assert res.status_code == 200
    assert res.json() == {"id": "pi_123", "client_secret": "pi_123_secret_abc"}
    assert calls["amount"] == 51553
    assert calls["currency"] == "thb"
    assert calls["metadata"] == {"table_number": "2", "session_token": "abcdefgh"}


def test_get_intent_rejects_non_intent_ids(stripe_keys):
    assert client.get("/api/payments/intents/ch_123").status_code == 404
