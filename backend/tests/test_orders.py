from types import SimpleNamespace

from tests.conftest import Phone


def order(phone, lines, pay="counter"):
    return phone.order(lines, pay)


PAD_THAI_SHRIMP = {
    "menuItemId": "pad-thai",
    "quantity": 2,
    "options": [{"groupId": "protein-noodles", "choiceId": "prawns"}],
    "note": " no peanuts ",
}


def test_server_prices_the_order(client, seated, phone):
    res = order(phone, [PAD_THAI_SHRIMP, {"menuItemId": "orange-juice", "quantity": 1}])
    assert res.status_code == 200
    o = res.json()["order"]
    # Pad Thai $20.90 + prawns $4 = $24.90 x 2, plus a $5 orange juice
    assert o["payment"] == {"status": "awaiting_counter", "amount": 5480}
    assert o["items"][0]["unitPrice"] == 2490
    assert o["items"][0]["note"] == "no peanuts"
    assert [opt["choiceName"] for opt in o["items"][0]["options"]] == ["Prawns"]
    assert o["number"] == 101 and o["round"] == 1


def test_browser_prices_are_ignored(client, seated, phone):
    line = {"menuItemId": "gai-tod", "quantity": 1, "unitPrice": 1, "price": 1}
    assert order(phone, [line]).json()["order"]["payment"]["amount"] == 1490


def test_single_choice_groups_need_exactly_one_choice(client, seated, phone):
    no_style = {"menuItemId": "som-tum", "quantity": 1}
    assert order(phone, [no_style]).status_code == 422
    two = {
        "menuItemId": "som-tum",
        "quantity": 1,
        "options": [
            {"groupId": "som-tum-style", "choiceId": "thai-style"},
            {"groupId": "som-tum-style", "choiceId": "mixed"},
        ],
    }
    assert order(phone, [two]).status_code == 422


def test_options_must_belong_to_the_dish(client, seated, phone):
    line = {
        "menuItemId": "gai-tod",
        "quantity": 1,
        "options": [{"groupId": "protein-noodles", "choiceId": "prawns"}],
    }
    assert order(phone, [line]).status_code == 422


def test_sold_out_and_hidden_dishes_cannot_be_ordered(client, staff, seated, phone):
    res = order(phone, [{"menuItemId": "coconut-juice", "quantity": 1}])
    assert res.status_code == 409 and "Coconut Juice" in res.json()["detail"]
    staff.put("/api/menu/items/orange-juice/hidden", json={"value": True})
    assert order(phone, [{"menuItemId": "orange-juice", "quantity": 1}]).status_code == 409


def test_counter_order_flow(staff, seated, phone):
    o = order(phone, [{"menuItemId": "gai-tod", "quantity": 1}]).json()["order"]
    assert staff.post(f"/api/orders/{o['id']}/served").status_code == 409
    paid = staff.post(f"/api/orders/{o['id']}/counter-payment", json={"method": "cash"}).json()
    assert paid["payment"]["status"] == "paid" and paid["payment"]["method"] == "cash"
    served = staff.post(f"/api/orders/{o['id']}/served").json()
    assert {i["status"] for i in served["items"]} == {"served"}
    assert staff.post(f"/api/sessions/{seated['id']}/close").status_code == 200


def test_counter_payment_records_discount_and_card_brand(staff, seated, phone):
    o = order(phone, [{"menuItemId": "gai-tod", "quantity": 2}]).json()["order"]
    body = {"method": "card_terminal", "discount": 500, "cardBrand": "visa"}
    paid = staff.post(f"/api/orders/{o['id']}/counter-payment", json=body).json()
    # 2 x $14.90 = $29.80, less $5
    assert paid["payment"]["amount"] == 2480
    assert paid["payment"]["discount"] == 500
    assert paid["payment"]["cardBrand"] == "visa"
    state = staff.get("/api/staff/state").json()
    saved = next(x for x in state["orders"] if x["id"] == o["id"])
    assert saved["payment"]["discount"] == 500 and saved["payment"]["cardBrand"] == "visa"


def test_counter_discount_cannot_be_more_than_the_bill(staff, seated, phone):
    o = order(phone, [{"menuItemId": "gai-tod", "quantity": 1}]).json()["order"]
    url = f"/api/orders/{o['id']}/counter-payment"
    assert staff.post(url, json={"method": "cash", "discount": 1491}).status_code == 422
    assert staff.post(url, json={"method": "cash", "discount": -1}).status_code == 422
    # A full discount is allowed (e.g. a staff meal)
    paid = staff.post(url, json={"method": "cash", "discount": 1490}).json()
    assert paid["payment"]["amount"] == 0 and paid["payment"]["discount"] == 1490


def test_card_brand_is_only_for_card_payments(staff, seated, phone):
    o = order(phone, [{"menuItemId": "gai-tod", "quantity": 1}]).json()["order"]
    url = f"/api/orders/{o['id']}/counter-payment"
    assert staff.post(url, json={"method": "cash", "cardBrand": "visa"}).status_code == 422
    assert (
        staff.post(url, json={"method": "card_terminal", "cardBrand": "diners"}).status_code == 422
    )
    # A card payment needs its type (REQ-39: the Payments report splits by it)
    assert staff.post(url, json={"method": "card_terminal"}).status_code == 422
    paid = staff.post(url, json={"method": "card_terminal", "cardBrand": "amex"}).json()
    assert paid["payment"]["status"] == "paid" and paid["payment"]["cardBrand"] == "amex"


def test_unpaid_counter_order_can_be_cancelled(staff, seated, phone):
    o = order(phone, [{"menuItemId": "gai-tod", "quantity": 1}]).json()["order"]
    cancelled = staff.post(f"/api/orders/{o['id']}/cancel").json()
    assert cancelled["payment"]["status"] == "cancelled"
    assert {i["status"] for i in cancelled["items"]} == {"cancelled"}


def test_item_status_follows_the_lifecycle(staff, seated, phone):
    o = order(phone, [{"menuItemId": "gai-tod", "quantity": 1}]).json()["order"]
    item = o["items"][0]["id"]
    url = f"/api/orders/{o['id']}/items/{item}/status"
    # Not paid yet: food is not served
    assert staff.put(url, json={"status": "served"}).status_code == 409
    staff.post(
        f"/api/orders/{o['id']}/counter-payment",
        json={"method": "card_terminal", "cardBrand": "visa"},
    )
    # No kitchen states for now
    assert staff.put(url, json={"status": "preparing"}).status_code == 422
    assert staff.put(url, json={"status": "served"}).status_code == 200
    assert staff.put(url, json={"status": "submitted"}).status_code == 409


def test_order_numbers_count_up_across_tables(staff, seated, phone):
    t2 = Phone(staff, staff.post("/api/tables/t2/sessions", json={"guests": 2}).json()["token"])
    a = order(phone, [{"menuItemId": "gai-tod", "quantity": 1}]).json()["order"]
    b = order(t2, [{"menuItemId": "gai-tod", "quantity": 1}]).json()["order"]
    c = order(phone, [{"menuItemId": "gai-tod", "quantity": 1}]).json()["order"]
    assert (a["number"], b["number"], c["number"]) == (101, 102, 103)
    assert (a["round"], b["round"], c["round"]) == (1, 1, 2)


# ---- Stripe ----


def test_simulated_payment_without_stripe_keys(client, staff, seated, phone):
    res = order(phone, [{"menuItemId": "gai-tod", "quantity": 2}], pay="stripe").json()
    assert res["payment"]["simulated"] is True
    o = res["order"]
    # Pending orders are not orders yet: no number, invisible to staff and the guest's list
    assert o["payment"]["status"] == "pending" and "number" not in o
    assert staff.get("/api/staff/state").json()["orders"] == []
    check = phone.post(f"/api/guest/orders/{o['id']}/confirm-payment").json()
    assert check["status"] == "succeeded"
    assert check["order"]["payment"]["status"] == "paid" and check["order"]["number"] == 101


def test_no_simulated_payments_outside_demo_mode(client, seated, phone, settings):
    settings.demo_mode = False
    res = order(phone, [{"menuItemId": "gai-tod", "quantity": 1}], pay="stripe")
    assert res.status_code == 503


def stripe_on(settings, monkeypatch, intent_status="succeeded", brand="visa"):
    settings.stripe_secret_key = "sk_test_dummy"
    settings.stripe_publishable_key = "pk_test_dummy"
    created = {}

    def fake_create(**kwargs):
        created.update(kwargs)
        return SimpleNamespace(
            id="pi_123", client_secret="pi_123_secret_abc", status="requires_payment_method"
        )

    def fake_retrieve(intent_id, **kwargs):
        # With expand=["latest_charge"] Stripe returns the charge, which names the card
        card = SimpleNamespace(brand=brand)
        charge = SimpleNamespace(payment_method_details=SimpleNamespace(type="card", card=card))
        return SimpleNamespace(
            id=intent_id,
            status=intent_status,
            amount=created["amount"],
            currency="aud",
            metadata=created["metadata"],
            latest_charge=charge if "latest_charge" in kwargs.get("expand", []) else "ch_123",
        )

    monkeypatch.setattr("stripe.PaymentIntent.create", fake_create)
    monkeypatch.setattr("stripe.PaymentIntent.retrieve", fake_retrieve)
    monkeypatch.setattr("stripe.PaymentIntent.cancel", lambda intent_id: None)
    return created


def test_stripe_intent_uses_the_server_amount(client, seated, phone, settings, monkeypatch):
    created = stripe_on(settings, monkeypatch)
    res = order(phone, [PAD_THAI_SHRIMP], pay="stripe").json()
    assert res["payment"] == {
        "intentId": "pi_123",
        "clientSecret": "pi_123_secret_abc",
        "simulated": False,
    }
    assert created["amount"] == 4980 and created["currency"] == "aud"
    assert created["metadata"]["order_id"] == res["order"]["id"]


def test_stripe_payment_confirmed_by_the_server(client, seated, phone, settings, monkeypatch):
    stripe_on(settings, monkeypatch)
    o = order(phone, [{"menuItemId": "gai-tod", "quantity": 1}], pay="stripe").json()["order"]
    check = phone.post("/api/guest/payments/pi_123/confirm").json()
    assert check["order"]["payment"]["status"] == "paid"
    assert check["order"]["payment"]["method"] == "stripe"
    # Confirming twice changes nothing
    again = phone.post(f"/api/guest/orders/{o['id']}/confirm-payment").json()
    assert again["order"]["number"] == check["order"]["number"]


def test_unfinished_stripe_payment_is_not_paid(client, seated, phone, settings, monkeypatch):
    stripe_on(settings, monkeypatch, intent_status="requires_payment_method")
    o = order(phone, [{"menuItemId": "gai-tod", "quantity": 1}], pay="stripe").json()["order"]
    check = phone.post(f"/api/guest/orders/{o['id']}/confirm-payment").json()
    assert check["status"] == "requires_payment_method"
    assert check["order"]["payment"]["status"] == "pending"


def test_other_sessions_cannot_confirm_an_order(
    client, staff, seated, phone, settings, monkeypatch
):
    stripe_on(settings, monkeypatch)
    o = order(phone, [{"menuItemId": "gai-tod", "quantity": 1}], pay="stripe").json()["order"]
    other = Phone(staff, staff.post("/api/tables/t2/sessions", json={"guests": 2}).json()["token"])
    assert other.post(f"/api/guest/orders/{o['id']}/confirm-payment").status_code == 404


def test_webhook_marks_the_order_paid(client, seated, phone, settings, monkeypatch):
    stripe_on(settings, monkeypatch)
    settings.stripe_webhook_secret = "whsec_test"
    o = order(phone, [{"menuItemId": "gai-tod", "quantity": 1}], pay="stripe").json()["order"]
    intent = _Obj(id="pi_123", amount=1490, currency="aud", metadata={"order_id": o["id"]})
    event = {"type": "payment_intent.succeeded", "data": {"object": intent}}
    # Signature checking is Stripe's code; here we only check what happens after it
    monkeypatch.setattr("stripe.Webhook.construct_event", lambda payload, sig, secret: event)
    res = client.post(
        "/api/payments/webhook", content=b"{}", headers={"Stripe-Signature": "t=1,v1=x"}
    )
    assert res.status_code == 200
    state = phone.state()
    assert state["orders"][0]["payment"]["status"] == "paid"


def test_webhook_rejects_bad_signatures(client, settings):
    settings.stripe_webhook_secret = "whsec_test"
    res = client.post(
        "/api/payments/webhook", content=b"{}", headers={"Stripe-Signature": "t=1,v1=bad"}
    )
    assert res.status_code == 400


def test_abandoned_checkout_is_dropped(client, seated, phone, settings, monkeypatch):
    stripe_on(settings, monkeypatch)
    o = order(phone, [{"menuItemId": "gai-tod", "quantity": 1}], pay="stripe").json()["order"]
    phone.post(f"/api/guest/orders/{o['id']}/abandon")
    check = phone.post(f"/api/guest/orders/{o['id']}/confirm-payment")
    # Stripe says succeeded after all: the money is recorded, not lost
    assert check.json()["order"]["payment"]["status"] == "paid"


class _Obj(dict):
    """Stripe objects allow both item and attribute access."""

    def __getattr__(self, name):
        return self[name]


def test_each_order_gets_its_own_stripe_key(client, seated, phone, settings, monkeypatch):
    # Order ids repeat across databases on one Stripe account; a reused key would make Stripe
    # hand back an old payment (ticket #19)
    stripe_on(settings, monkeypatch)
    keys = []

    def fake_create(**kwargs):
        keys.append(kwargs["idempotency_key"])
        n = len(keys)
        return SimpleNamespace(id=f"pi_{n}", client_secret="x", status="requires_payment_method")

    monkeypatch.setattr("stripe.PaymentIntent.create", fake_create)
    for _ in range(2):
        order(phone, [{"menuItemId": "gai-tod", "quantity": 1}], pay="stripe")
    assert all(k.startswith("oms-order-") for k in keys) and keys[0] != keys[1]


def test_an_old_payment_never_pays_a_new_order(client, staff, seated, phone, settings, monkeypatch):
    stripe_on(settings, monkeypatch)
    monkeypatch.setattr(
        "stripe.PaymentIntent.create",
        lambda **kwargs: SimpleNamespace(id="pi_old", client_secret="x", status="succeeded"),
    )
    res = order(phone, [{"menuItemId": "gai-tod", "quantity": 1}], pay="stripe")
    assert res.status_code == 502
    assert staff.get("/api/staff/state").json()["orders"] == []
