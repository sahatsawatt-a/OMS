from app.services.live import live


def test_a_change_is_announced(staff, client):
    with client.websocket_connect("/api/ws") as ws:
        res = staff.put("/api/menu/items/pad-thai/sold-out", json={"value": True})
        assert res.status_code == 200
        assert ws.receive_json() == {"type": "changed"}


def test_guest_order_is_announced(staff, client, seated):
    with client.websocket_connect("/api/ws") as ws:
        res = client.post(f"/api/sessions/{seated}/waiter")
        assert res.status_code == 200
        assert ws.receive_json() == {"type": "changed"}


def test_only_writes_announce(staff, client, monkeypatch):
    calls = []
    monkeypatch.setattr(live, "notify", lambda: calls.append(1))
    client.get("/api/menu")
    staff.get("/api/staff/state")
    assert calls == []
    staff.put("/api/menu/items/pad-thai/hidden", json={"value": True})
    assert calls == [1]
