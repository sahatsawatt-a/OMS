"""Each phone at a table is its own device (REQ-37); tokens stay out of URLs (REQ-36)."""

from app.services.devices import label_for
from tests.conftest import Phone

GAI_TOD = [{"menuItemId": "gai-tod", "quantity": 1}]


def test_labels():
    assert [label_for(n) for n in (0, 1, 25, 26, 27)] == ["A", "B", "Z", "AA", "AB"]


def test_phones_get_letters_in_turn(client, seated):
    a, b, c = (Phone(client, seated["token"]) for _ in range(3))
    assert (a.label, b.label, c.label) == ("A", "B", "C")
    assert len({a.token, b.token, c.token}) == 3


def test_rescan_on_the_same_phone_keeps_its_letter(client, seated, phone):
    again = Phone(client, seated["token"], device_token=phone.token)
    assert (again.label, again.token) == ("A", phone.token)
    assert Phone(client, seated["token"]).label == "B"


def test_device_token_from_another_table_gets_a_new_device(client, staff, phone):
    t2 = staff.post("/api/tables/t2/sessions", json={"guests": 2}).json()
    there = Phone(client, t2["token"], device_token=phone.token)
    assert there.label == "A" and there.token != phone.token


def test_orders_record_their_phone(client, staff, seated, phone):
    b = Phone(client, seated["token"])
    phone.order(GAI_TOD)
    b.order(GAI_TOD)
    devices = [o["device"] for o in staff.get("/api/staff/state").json()["orders"]]
    assert devices == ["A", "B"]
    # Every phone sees the whole table, each order with its letter, but never the QR token
    orders = b.state()["orders"]
    assert [o["device"] for o in orders] == ["A", "B"]
    assert all("sessionToken" not in o for o in orders)


def test_a_phone_cannot_pay_for_or_drop_another_phones_order(client, seated, phone):
    b = Phone(client, seated["token"])
    o = phone.order(GAI_TOD, pay="stripe").json()["order"]
    assert b.post(f"/api/guest/orders/{o['id']}/confirm-payment").status_code == 404
    assert b.post(f"/api/guest/orders/{o['id']}/abandon").status_code == 404


def test_staff_see_phones_and_can_remove_one(client, staff, seated, phone):
    b = Phone(client, seated["token"])
    session = staff.get("/api/staff/state").json()["sessions"][seated["token"]]
    assert [d["label"] for d in session["devices"]] == ["A", "B"]

    assert staff.delete(f"/api/sessions/{seated['id']}/devices/B").status_code == 200
    assert b.get("/api/guest/state").status_code == 403
    assert b.order(GAI_TOD).status_code == 403
    # Scanning again with the removed phone's token doesn't bring it back
    rejoin = client.post(
        "/api/guest/join",
        headers={"X-Session-Token": seated["token"], "X-Device-Token": b.token},
    )
    assert rejoin.status_code == 403
    assert phone.get("/api/guest/state").status_code == 200
    session = staff.get("/api/staff/state").json()["sessions"][seated["token"]]
    assert session["devices"][1]["removedAt"] > 0
    assert staff.delete(f"/api/sessions/{seated['id']}/devices/Z").status_code == 404


def test_clearing_the_table_ends_every_phone(client, staff, seated, phone):
    b = Phone(client, seated["token"])
    staff.post(f"/api/sessions/{seated['id']}/close")
    for p in (phone, b):
        assert p.state()["session"]["status"] == "closed"
        assert p.order(GAI_TOD).status_code == 410
    join = client.post("/api/guest/join", headers={"X-Session-Token": seated["token"]})
    assert join.status_code == 410


def test_at_most_two_orders_wait_at_the_counter(client, seated, phone):
    b = Phone(client, seated["token"])
    assert phone.order(GAI_TOD).status_code == 200
    assert b.order(GAI_TOD).status_code == 200
    res = phone.order(GAI_TOD)
    assert res.status_code == 409 and "waiting for payment" in res.json()["detail"]
    # Paying on the phone is still possible
    assert phone.order(GAI_TOD, pay="stripe").status_code == 200


def test_waiter_call_twice_writes_once(phone, monkeypatch):
    from app.services.live import live

    calls = []
    monkeypatch.setattr(live, "notify", lambda: calls.append(1))
    phone.post("/api/guest/waiter")
    phone.post("/api/guest/waiter")
    assert calls == [1]


def test_stripe_never_gets_the_qr_token(client, seated, phone, settings, monkeypatch):
    from tests.test_orders import stripe_on

    created = stripe_on(settings, monkeypatch)
    phone.order(GAI_TOD, pay="stripe")
    assert seated["token"] not in str(created["metadata"])
    assert created["metadata"]["device"] == "A"
