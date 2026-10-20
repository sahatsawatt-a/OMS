def test_config_disabled_without_keys(client):
    assert client.get("/api/payments/config").json() == {
        "enabled": False,
        "publishable_key": "",
        "simulated": True,
    }


def test_config_exposes_only_publishable_key(client, settings):
    settings.stripe_secret_key = "sk_test_dummy"
    settings.stripe_publishable_key = "pk_test_dummy"
    body = client.get("/api/payments/config").json()
    assert body == {"enabled": True, "publishable_key": "pk_test_dummy", "simulated": False}


def test_old_browser_priced_intent_endpoint_is_gone(client):
    body = {"amount": 5000, "table_number": 3, "session_token": "abcdefgh"}
    assert client.post("/api/payments/intents", json=body).status_code in (404, 405)
