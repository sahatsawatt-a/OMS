from types import SimpleNamespace


def order(client, token, lines, pay="counter"):
    return client.post(f"/api/sessions/{token}/orders", json={"lines": lines, "pay": pay})


PAD_THAI_SHRIMP = {
    "menuItemId": "pad-thai",
    "quantity": 2,
    "options": [{"groupId": "protein-noodles", "choiceId": "prawns"}],
    "note": " no peanuts ",
}


def test_server_prices_the_order(client, seated):
    res = order(client, seated, [PAD_THAI_SHRIMP, {"menuItemId": "orange-juice", "quantity": 1}])
    assert res.status_code == 200
    o = res.json()["order"]
    # Pad Thai $20.90 + prawns $4 = $24.90 x 2, plus a $5 orange juice
    assert o["payment"] == {"status": "awaiting_counter", "amount": 5480}
    assert o["items"][0]["unitPrice"] == 2490
    assert o["items"][0]["note"] == "no peanuts"
    assert [opt["choiceName"] for opt in o["items"][0]["options"]] == ["Prawns"]
    assert o["number"] == 101 and o["round"] == 1


def test_browser_prices_are_ignored(client, seated):
    line = {"menuItemId": "gai-tod", "quantity": 1, "unitPrice": 1, "price": 1}
    assert order(client, seated, [line]).json()["order"]["payment"]["amount"] == 1490


def test_single_choice_groups_need_exactly_one_choice(client, seated):
    no_style = {"menuItemId": "som-tum", "quantity": 1}
    assert order(client, seated, [no_style]).status_code == 422
    two = {
        "menuItemId": "som-tum",
        "quantity": 1,
        "options": [
            {"groupId": "som-tum-style", "choiceId": "thai-style"},
            {"groupId": "som-tum-style", "choiceId": "mixed"},
        ],
    }
    assert order(client, seated, [two]).status_code == 422


def test_options_must_belong_to_the_dish(client, seated):
    line = {
        "menuItemId": "gai-tod",
        "quantity": 1,
        "options": [{"groupId": "protein-noodles", "choiceId": "prawns"}],
    }
    assert order(client, seated, [line]).status_code == 422


def test_sold_out_and_hidden_dishes_cannot_be_ordered(client, staff, seated):
    res = order(client, seated, [{"menuItemId": "coconut-juice", "quantity": 1}])
    assert res.status_code == 409 and "Coconut Juice" in res.json()["detail"]
    staff.put("/api/menu/items/orange-juice/hidden", json={"value": True})
    assert order(client, seated, [{"menuItemId": "orange-juice", "quantity": 1}]).status_code == 409


def test_counter_order_flow(staff, seated):
    o = order(staff, seated, [{"menuItemId": "gai-tod", "quantity": 1}]).json()["order"]
    assert staff.post(f"/api/orders/{o['id']}/served").status_code == 409
    paid = staff.post(f"/api/orders/{o['id']}/counter-payment", json={"method": "cash"}).json()
    assert paid["payment"]["status"] == "paid" and paid["payment"]["method"] == "cash"
    served = staff.post(f"/api/orders/{o['id']}/served").json()
    assert {i["status"] for i in served["items"]} == {"served"}
    assert staff.post(f"/api/sessions/{seated}/close").status_code == 200


def test_unpaid_counter_order_can_be_cancelled(staff, seated):
    o = order(staff, seated, [{"menuItemId": "gai-tod", "quantity": 1}]).json()["order"]
    cancelled = staff.post(f"/api/orders/{o['id']}/cancel").json()
    assert cancelled["payment"]["status"] == "cancelled"
    assert {i["status"] for i in cancelled["items"]} == {"cancelled"}


def test_item_status_follows_the_lifecycle(staff, seated):
    o = order(staff, seated, [{"menuItemId": "gai-tod", "quantity": 1}]).json()["order"]
    item = o["items"][0]["id"]
    url = f"/api/orders/{o['id']}/items/{item}/status"
    # Not paid yet: food is not served
    assert staff.put(url, json={"status": "served"}).status_code == 409
    staff.post(f"/api/orders/{o['id']}/counter-payment", json={"method": "card_terminal"})
    # No kitchen states for now
    assert staff.put(url, json={"status": "preparing"}).status_code == 422
    assert staff.put(url, json={"status": "served"}).status_code == 200
    assert staff.put(url, json={"status": "submitted"}).status_code == 409


def test_order_numbers_count_up_across_tables(staff, seated):
    t2 = staff.post("/api/tables/t2/sessions", json={"guests": 2}).json()["token"]
    a = order(staff, seated, [{"menuItemId": "gai-tod", "quantity": 1}]).json()["order"]
    b = order(staff, t2, [{"menuItemId": "gai-tod", "quantity": 1}]).json()["order"]
    c = order(staff, seated, [{"menuItemId": "gai-tod", "quantity": 1}]).json()["order"]
    assert (a["number"], b["number"], c["number"]) == (101, 102, 103)
    assert (a["round"], b["round"], c["round"]) == (1, 1, 2)


# ---- Stripe ----


def test_simulated_payment_without_stripe_keys(client, staff, seated):
    res = order(client, seated, [{"menuItemId": "gai-tod", "quantity": 2}], pay="stripe").json()
    assert res["payment"]["simulated"] is True
    o = res["order"]
    # Pending orders are not orders yet: no number, invisible to staff and the guest's list
    assert o["payment"]["status"] == "pending" and "number" not in o
    assert staff.get("/api/staff/state").json()["orders"] == []
    check = client.post(f"/api/sessions/{seated}/orders/{o['id']}/confirm-payment").json()
    assert check["status"] == "succeeded"
    assert check["order"]["payment"]["status"] == "paid" and check["order"]["number"] == 101


def test_no_simulated_payments_outside_demo_mode(client, seated, settings):
    settings.demo_mode = False
    res = order(client, seated, [{"menuItemId": "gai-tod", "quantity": 1}], pay="stripe")
    assert res.status_code == 503


def stripe_on(settings, monkeypatch, intent_status="succeeded"):
    settings.stripe_secret_key = "sk_test_dummy"
    settings.stripe_publishable_key = "pk_test_dummy"
    created = {}

    def fake_create(**kwargs):
        created.update(kwargs)
        return SimpleNamespace(id="pi_123", client_secret="pi_123_secret_abc")

    def fake_retrieve(intent_id):
        return SimpleNamespace(
            id=intent_id,
            status=intent_status,
            amount=created["amount"],
            currency="aud",
            metadata=created["metadata"],
        )

    monkeypatch.setattr("stripe.PaymentIntent.create", fake_create)
    monkeypatch.setattr("stripe.PaymentIntent.retrieve", fake_retrieve)
    monkeypatch.setattr("stripe.PaymentIntent.cancel", lambda intent_id: None)
    return created


def test_stripe_intent_uses_the_server_amount(client, seated, settings, monkeypatch):
    created = stripe_on(settings, monkeypatch)
    res = order(client, seated, [PAD_THAI_SHRIMP], pay="stripe").json()
    assert res["payment"] == {
        "intentId": "pi_123",
        "clientSecret": "pi_123_secret_abc",
        "simulated": False,
    }
    assert created["amount"] == 4980 and created["currency"] == "aud"
    assert created["metadata"]["order_id"] == res["order"]["id"]


def test_stripe_payment_confirmed_by_the_server(client, seated, settings, monkeypatch):
    stripe_on(settings, monkeypatch)
    o = order(client, seated, [{"menuItemId": "gai-tod", "quantity": 1}], pay="stripe").json()[
        "order"
    ]
    check = client.post(f"/api/sessions/{seated}/payments/pi_123/confirm").json()
    assert check["order"]["payment"]["status"] == "paid"
    assert check["order"]["payment"]["method"] == "stripe"
    # Confirming twice changes nothing
    again = client.post(f"/api/sessions/{seated}/orders/{o['id']}/confirm-payment").json()
    assert again["order"]["number"] == check["order"]["number"]


def test_unfinished_stripe_payment_is_not_paid(client, seated, settings, monkeypatch):
    stripe_on(settings, monkeypatch, intent_status="requires_payment_method")
    o = order(client, seated, [{"menuItemId": "gai-tod", "quantity": 1}], pay="stripe").json()[
        "order"
    ]
    check = client.post(f"/api/sessions/{seated}/orders/{o['id']}/confirm-payment").json()
    assert check["status"] == "requires_payment_method"
    assert check["order"]["payment"]["status"] == "pending"


def test_other_sessions_cannot_confirm_an_order(client, staff, seated, settings, monkeypatch):
    stripe_on(settings, monkeypatch)
    o = order(client, seated, [{"menuItemId": "gai-tod", "quantity": 1}], pay="stripe").json()[
        "order"
    ]
    other = staff.post("/api/tables/t2/sessions", json={"guests": 2}).json()["token"]
    assert client.post(f"/api/sessions/{other}/orders/{o['id']}/confirm-payment").status_code == 404


def test_webhook_marks_the_order_paid(client, seated, settings, monkeypatch):
    stripe_on(settings, monkeypatch)
    settings.stripe_webhook_secret = "whsec_test"
    o = order(client, seated, [{"menuItemId": "gai-tod", "quantity": 1}], pay="stripe").json()[
        "order"
    ]
    intent = _Obj(id="pi_123", amount=1490, currency="aud", metadata={"order_id": o["id"]})
    event = {"type": "payment_intent.succeeded", "data": {"object": intent}}
    # Signature checking is Stripe's code; here we only check what happens after it
    monkeypatch.setattr("stripe.Webhook.construct_event", lambda payload, sig, secret: event)
    res = client.post(
        "/api/payments/webhook", content=b"{}", headers={"Stripe-Signature": "t=1,v1=x"}
    )
    assert res.status_code == 200
    state = client.get(f"/api/sessions/{seated}").json()
    assert state["orders"][0]["payment"]["status"] == "paid"


def test_webhook_rejects_bad_signatures(client, settings):
    settings.stripe_webhook_secret = "whsec_test"
    res = client.post(
        "/api/payments/webhook", content=b"{}", headers={"Stripe-Signature": "t=1,v1=bad"}
    )
    assert res.status_code == 400


def test_abandoned_checkout_is_dropped(client, seated, settings, monkeypatch):
    stripe_on(settings, monkeypatch)
    o = order(client, seated, [{"menuItemId": "gai-tod", "quantity": 1}], pay="stripe").json()[
        "order"
    ]
    client.post(f"/api/sessions/{seated}/orders/{o['id']}/abandon")
    check = client.post(f"/api/sessions/{seated}/orders/{o['id']}/confirm-payment")
    # Stripe says succeeded after all: the money is recorded, not lost
    assert check.json()["order"]["payment"]["status"] == "paid"


class _Obj(dict):
    """Stripe objects allow both item and attribute access."""

    def __getattr__(self, name):
        return self[name]
