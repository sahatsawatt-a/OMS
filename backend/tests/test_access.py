import pytest

STAFF_ENDPOINTS = [
    ("get", "/api/staff/state"),
    ("get", "/api/menu/all"),
    ("post", "/api/tables/t1/sessions"),
    ("post", "/api/sessions/1/close"),
    ("delete", "/api/sessions/1/waiter"),
    ("delete", "/api/sessions/1/devices/A"),
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


def test_unknown_tokens_are_refused(client):
    assert client.post("/api/guest/join", headers={"X-Session-Token": "nope"}).status_code == 404
    assert client.post("/api/guest/join").status_code == 401
    assert client.get("/api/guest/state").status_code == 401
    assert client.get("/api/guest/state", headers={"X-Device-Token": "nope"}).status_code == 401
    res = client.post(
        "/api/guest/orders",
        headers={"X-Device-Token": "nope"},
        json={"lines": [{"menuItemId": "gai-tod", "quantity": 1}], "pay": "counter"},
    )
    assert res.status_code == 401


def test_qr_token_is_not_a_device_token(client, seated):
    headers = {"X-Device-Token": seated["token"]}
    assert client.get("/api/guest/state", headers=headers).status_code == 401


def test_browser_check_key_also_works_and_can_be_revoked(client, settings):
    settings.browser_check_key = "check-key"
    assert client.get("/api/staff/check", headers={"X-Staff-Key": "check-key"}).status_code == 200
    settings.browser_check_key = ""
    assert client.get("/api/staff/check", headers={"X-Staff-Key": "check-key"}).status_code == 401


# ---- Admin key (staff can't change the menu or the floor plan) ----

ADMIN_ENDPOINTS = [
    ("get", "/api/admin/check"),
    ("get", "/api/menu/all"),
    ("put", "/api/menu/items/pad-thai"),
    ("put", "/api/menu/items/pad-thai/hidden"),
    ("delete", "/api/menu/items/pad-thai"),
    ("post", "/api/menu/categories"),
    ("post", "/api/menu/reset"),
    ("put", "/api/floor"),
]


@pytest.mark.parametrize(("method", "path"), ADMIN_ENDPOINTS)
def test_staff_key_cannot_use_admin_endpoints(client, settings, method, path):
    settings.admin_api_key = "admin-key"
    res = getattr(client, method)(path, headers={"X-Staff-Key": "test-staff-key"})
    assert res.status_code == 403
    assert getattr(client, method)(path).status_code == 401


def test_staff_key_still_works_for_front_of_house(client, settings):
    settings.admin_api_key = "admin-key"
    headers = {"X-Staff-Key": "test-staff-key"}
    assert client.get("/api/staff/state", headers=headers).status_code == 200
    # Marking a dish sold out during service is a staff job
    res = client.put("/api/menu/items/pad-thai/sold-out", headers=headers, json={"value": True})
    assert res.status_code == 200


def test_admin_key_opens_both(client, settings):
    settings.admin_api_key = "admin-key"
    headers = {"X-Staff-Key": "admin-key"}
    assert client.get("/api/admin/check", headers=headers).status_code == 200
    assert client.get("/api/staff/state", headers=headers).status_code == 200
    assert client.get("/api/menu/all", headers=headers).status_code == 200


def test_without_an_admin_key_the_staff_key_opens_admin(client, settings):
    settings.admin_api_key = ""
    res = client.get("/api/admin/check", headers={"X-Staff-Key": "test-staff-key"})
    assert res.status_code == 200


def test_browser_check_key_can_do_admin_checks(client, settings):
    settings.admin_api_key = "admin-key"
    settings.browser_check_key = "check-key"
    assert client.get("/api/admin/check", headers={"X-Staff-Key": "check-key"}).status_code == 200
