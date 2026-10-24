"""Card payments record their card type for the Payments report (REQ-39)."""

from app.services.orders import card_brand_of
from tests.test_orders import _Obj, stripe_on

GAI_TOD = [{"menuItemId": "gai-tod", "quantity": 1}]


def _staff_order(staff, order_id):
    return next(o for o in staff.get("/api/staff/state").json()["orders"] if o["id"] == order_id)


def test_counter_card_needs_its_type(staff, phone):
    o = phone.order(GAI_TOD).json()["order"]
    url = f"/api/orders/{o['id']}/counter-payment"
    assert staff.post(url, json={"method": "card_terminal"}).status_code == 422
    assert (
        staff.post(url, json={"method": "card_terminal", "cardBrand": "diners"}).status_code == 422
    )
    paid = staff.post(url, json={"method": "card_terminal", "cardBrand": "mastercard"}).json()
    assert paid["payment"]["method"] == "card_terminal"
    assert paid["payment"]["cardBrand"] == "mastercard"


def test_cash_has_no_card_type(staff, phone):
    o = phone.order(GAI_TOD).json()["order"]
    url = f"/api/orders/{o['id']}/counter-payment"
    assert staff.post(url, json={"method": "cash", "cardBrand": "visa"}).status_code == 422
    paid = staff.post(url, json={"method": "cash"}).json()
    assert paid["payment"]["method"] == "cash" and "cardBrand" not in paid["payment"]


def test_phone_payment_takes_the_type_from_stripe(staff, phone, settings, monkeypatch):
    stripe_on(settings, monkeypatch, brand="eftpos_au")
    o = phone.order(GAI_TOD, pay="stripe").json()["order"]
    check = phone.post(f"/api/guest/orders/{o['id']}/confirm-payment").json()
    assert check["order"]["payment"]["cardBrand"] == "eftpos"
    assert _staff_order(staff, o["id"])["payment"]["cardBrand"] == "eftpos"


def test_simulated_demo_card_counts_as_visa(staff, phone):
    o = phone.order(GAI_TOD, pay="stripe").json()["order"]
    check = phone.post(f"/api/guest/orders/{o['id']}/confirm-payment").json()
    assert check["order"]["payment"]["cardBrand"] == "visa"


def test_webhook_reads_the_type_from_the_charge(client, phone, settings, monkeypatch):
    stripe_on(settings, monkeypatch)
    settings.stripe_webhook_secret = "whsec_test"
    o = phone.order(GAI_TOD, pay="stripe").json()["order"]
    intent = _Obj(
        id="pi_123",
        amount=1490,
        currency="aud",
        metadata={"order_id": o["id"]},
        latest_charge="ch_9",
    )
    event = {"type": "payment_intent.succeeded", "data": {"object": intent}}
    monkeypatch.setattr("stripe.Webhook.construct_event", lambda payload, sig, secret: event)
    charge = _Obj(payment_method_details=_Obj(type="card", card=_Obj(brand="mastercard")))
    monkeypatch.setattr("stripe.Charge.retrieve", lambda charge_id: charge)
    client.post("/api/payments/webhook", content=b"{}", headers={"Stripe-Signature": "t=1,v1=x"})
    assert phone.state()["orders"][0]["payment"]["cardBrand"] == "mastercard"


def test_brand_mapping():
    def intent(type_="card", brand=None):
        details = _Obj(type=type_, card=_Obj(brand=brand) if brand else None)
        return _Obj(latest_charge=_Obj(payment_method_details=details))

    assert card_brand_of(intent(brand="visa")) == "visa"
    assert card_brand_of(intent(brand="amex")) == "amex"
    assert card_brand_of(intent(brand="eftpos_au")) == "eftpos"
    assert card_brand_of(intent(brand="discover")) == "other"
    assert card_brand_of(intent(type_="afterpay_clearpay")) == "other"
    assert card_brand_of(_Obj(latest_charge=None)) is None
