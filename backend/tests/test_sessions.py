def test_seating_returns_a_long_random_token(staff):
    s = staff.post("/api/tables/t2/sessions", json={"guests": 2}).json()
    assert len(s["token"]) >= 22
    assert s["tableNumber"] == 2 and s["status"] == "open" and s["guests"] == 2


def test_a_table_has_one_open_session(staff):
    a = staff.post("/api/tables/t2/sessions", json={"guests": 2}).json()
    b = staff.post("/api/tables/t2/sessions", json={"guests": 3}).json()
    assert a["token"] == b["token"]


def test_guest_sees_session_and_menu(phone):
    state = phone.state()
    assert state["session"]["tableNumber"] == 3
    assert state["device"] == "A"
    assert len(state["menu"]["items"]) == 93
    assert state["orders"] == []
    # The phone never gets the table's QR token back
    assert "token" not in state["session"]


def test_closed_session_cannot_order_or_call_waiter(staff, seated, phone):
    assert staff.post(f"/api/sessions/{seated['id']}/close").status_code == 200
    assert phone.state()["session"]["status"] == "closed"
    res = phone.order([{"menuItemId": "gai-tod", "quantity": 1}])
    assert res.status_code == 410
    assert phone.post("/api/guest/waiter").status_code == 410
    # The table can be seated again with a new token
    again = staff.post("/api/tables/t3/sessions", json={"guests": 2}).json()
    assert again["token"] != seated["token"]


def test_waiter_call_and_acknowledge(staff, seated, phone):
    phone.post("/api/guest/waiter")
    token = seated["token"]
    assert staff.get("/api/staff/state").json()["sessions"][token]["waiterCalledAt"] > 0
    staff.delete(f"/api/sessions/{seated['id']}/waiter")
    assert "waiterCalledAt" not in staff.get("/api/staff/state").json()["sessions"][token]


def test_cannot_clear_table_with_unpaid_counter_order(staff, seated, phone):
    phone.order([{"menuItemId": "gai-tod", "quantity": 1}])
    res = staff.post(f"/api/sessions/{seated['id']}/close")
    assert res.status_code == 409


def test_demo_reset_seats_sample_tables(staff):
    assert staff.post("/api/demo/reset").status_code == 200
    state = staff.get("/api/staff/state").json()
    open_tables = sorted(
        s["tableNumber"] for s in state["sessions"].values() if s["status"] == "open"
    )
    assert open_tables == [2, 3, 5, 6, 7]
    numbers = sorted(o["number"] for o in state["orders"])
    assert numbers == list(range(101, 101 + len(numbers)))
    assert any(o["payment"]["status"] == "awaiting_counter" for o in state["orders"])
    staff.post("/api/demo/clear")
    assert staff.get("/api/staff/state").json()["sessions"] == {}


def test_demo_reset_is_off_outside_demo_mode(staff, settings):
    settings.demo_mode = False
    assert staff.post("/api/demo/reset").status_code == 404


def test_demo_reset_works_after_phones_joined(staff, phone):
    # Phones (table_devices) belong to sessions: the reset must remove them too
    phone.order([{"menuItemId": "gai-tod", "quantity": 1}])
    assert staff.post("/api/demo/reset").status_code == 200
    assert staff.post("/api/demo/clear").status_code == 200
