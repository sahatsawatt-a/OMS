import pytest

STAFF_ENDPOINTS = [
    ("get", "/api/staff/state"),
    ("get", "/api/menu/all"),
    ("post", "/api/tables/t1/sessions"),
    ("post", "/api/sessions/abc/close"),
    ("delete", "/api/sessions/abc/waiter"),
    ("post", "/api/orders/1/counter-payment"),
    ("post", "/api/orders/1/cancel"),
    ("post", "/api/orders/1/served"),
    ("put", "/api/orders/1/items/1/status"),
    ("put", "/api/menu/items/pad-thai"),
    ("put", "/api/menu/items/pad-thai/sold-out"),
    ("delete", "/api/menu/items/pad-thai"),
    ("post", "/api/menu/categories"),
    ("post", "/api/menu/reset"),
    ("post", "/api/demo/reset"),
]


@pytest.mark.parametrize(("method", "path"), STAFF_ENDPOINTS)
def test_staff_endpoints_need_the_key(client, method, path):
    assert getattr(client, method)(path).status_code == 401
    wrong = getattr(client, method)(path, headers={"X-Staff-Key": "wrong"})
    assert wrong.status_code == 401


def test_no_configured_key_locks_staff_out(client, settings):
    settings.staff_api_key = ""
    assert client.get("/api/staff/state", headers={"X-Staff-Key": ""}).status_code == 401


def test_staff_key_works(staff):
    assert staff.get("/api/staff/check").json() == {"ok": True}


def test_menu_is_public_without_hidden_dishes(client, staff):
    staff.put("/api/menu/items/orange-juice/hidden", json={"value": True})
    del client.headers["X-Staff-Key"]
    menu = client.get("/api/menu").json()
    ids = {m["id"] for m in menu["items"]}
    assert "pad-thai" in ids and "orange-juice" not in ids
    assert set(menu["soldOut"]) == {"coconut-juice", "poo-pud-num-prik-pow"}


def test_unknown_session_token_gets_404(client):
    assert client.get("/api/sessions/not-a-real-token").status_code == 404
    res = client.post(
        "/api/sessions/not-a-real-token/orders",
        json={"lines": [{"menuItemId": "gai-tod", "quantity": 1}], "pay": "counter"},
    )
    assert res.status_code == 404


def test_browser_check_key_also_works_and_can_be_revoked(client, settings):
    settings.browser_check_key = "check-key"
    assert client.get("/api/staff/check", headers={"X-Staff-Key": "check-key"}).status_code == 200
    settings.browser_check_key = ""
    assert client.get("/api/staff/check", headers={"X-Staff-Key": "check-key"}).status_code == 401
