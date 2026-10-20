"""Guest endpoints (REQ-36, REQ-37).

A phone joins its table once with the QR code's token (X-Session-Token) and gets its own device
token; every other call sends that in X-Device-Token. Neither token is ever part of a URL.
"""

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.db.session import get_db
from app.models import Order, TableDevice
from app.schemas import (
    GuestState,
    JoinOut,
    PaymentCheckOut,
    PlaceOrderIn,
    PlaceOrderOut,
    StripeCheckout,
)
from app.services.devices import current_device, join
from app.services.orders import (
    cancel_intent,
    cancel_order,
    confirm_stripe,
    lock_open_session,
    place_order,
)
from app.services.views import VISIBLE_STATUSES, guest_session_out, menu_out, order_out

router = APIRouter(prefix="/guest", tags=["guest"])


@router.post("/join")
def join_table(
    x_session_token: str | None = Header(default=None),
    x_device_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> JoinOut:
    """
    Scanning the QR code. A phone that already joined this table (it sends its device token)
    keeps its letter; any other phone gets the next one.
    """
    if not x_session_token:
        raise HTTPException(401, "Scan the QR code on your table to start ordering.")
    device = join(db, x_session_token, x_device_token)
    return JoinOut(device_token=device.token, label=device.label)


def _own_order(db: Session, device: TableDevice, order_id: int) -> Order:
    """Only the phone that placed an order can pay for or drop it."""
    order = db.get(Order, order_id)
    if order is None or order.device_id != device.id:
        raise HTTPException(404, "Unknown order")
    return order


@router.get("/state", response_model_exclude_none=True)
def guest_state(
    device: TableDevice = Depends(current_device), db: Session = Depends(get_db)
) -> GuestState:
    """The table (open or closed), this phone's letter, the table's orders and the menu."""
    s = device.session
    menu = menu_out(db, include_hidden=False)
    if s.status != "open":
        # A finished visit shows only the thank-you message; no menu or orders
        return GuestState(
            session=guest_session_out(s),
            device=device.label,
            orders=[],
            menu=menu.model_copy(update={"items": []}),
        )
    orders = db.scalars(
        select(Order)
        .where(Order.session_id == s.id, Order.payment_status.in_(VISIBLE_STATUSES))
        .order_by(Order.created_at)
    ).all()
    return GuestState(
        session=guest_session_out(s),
        device=device.label,
        orders=[order_out(o, staff=False) for o in orders],
        menu=menu,
    )


@router.post("/orders", response_model_exclude_none=True)
def create_order(
    body: PlaceOrderIn,
    device: TableDevice = Depends(current_device),
    db: Session = Depends(get_db),
) -> PlaceOrderOut:
    """
    Pay first. "counter": the order waits for staff to take the money.
    "stripe": the order waits until the payment is confirmed; the reply has the client secret.
    """
    checkout = place_order(db, device, body.lines, body.pay)
    payment = (
        StripeCheckout(
            intent_id=checkout.intent_id,
            client_secret=checkout.client_secret,
            simulated=checkout.simulated,
        )
        if checkout.intent_id
        else None
    )
    return PlaceOrderOut(order=order_out(checkout.order, staff=False), payment=payment)


@router.post("/orders/{order_id}/confirm-payment", response_model_exclude_none=True)
def confirm_payment(
    order_id: int, device: TableDevice = Depends(current_device), db: Session = Depends(get_db)
) -> PaymentCheckOut:
    """After Stripe.js says the card went through, the server checks with Stripe itself."""
    order = _own_order(db, device, order_id)
    status = confirm_stripe(db, order)
    return PaymentCheckOut(status=status, order=order_out(order, staff=False))


@router.post("/payments/{intent_id}/confirm", response_model_exclude_none=True)
def confirm_by_intent(
    intent_id: str, device: TableDevice = Depends(current_device), db: Session = Depends(get_db)
) -> PaymentCheckOut:
    """Same check, for guests coming back from a redirect-based payment method."""
    order = db.scalars(select(Order).where(Order.stripe_intent_id == intent_id)).first()
    if order is None or order.device_id != device.id:
        raise HTTPException(404, "Unknown payment")
    status = confirm_stripe(db, order)
    return PaymentCheckOut(status=status, order=order_out(order, staff=False))


@router.post("/orders/{order_id}/abandon")
def abandon_checkout(
    order_id: int, device: TableDevice = Depends(current_device), db: Session = Depends(get_db)
) -> dict[str, bool]:
    """The guest closed the card form without paying: drop the pending order."""
    order = _own_order(db, device, order_id)
    if order.payment_status == "pending":
        cancel_intent(order.stripe_intent_id)
        cancel_order(order)
        db.commit()
    return {"ok": True}


@router.post("/waiter")
def call_waiter(
    device: TableDevice = Depends(current_device), db: Session = Depends(get_db)
) -> dict[str, bool]:
    s = lock_open_session(db, device.session_id)
    # Already called: nothing to change, so no write and no change notice to every screen
    if s.waiter_called_at is None:
        s.waiter_called_at = utcnow()
        db.commit()
    return {"ok": True}
