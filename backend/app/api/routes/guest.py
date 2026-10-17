"""Guest endpoints. The table session token from the QR code is the guest's key."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.db.session import get_db
from app.models import Order, TableSession
from app.schemas import GuestState, PaymentCheckOut, PlaceOrderIn, PlaceOrderOut, StripeCheckout
from app.services.orders import (
    cancel_intent,
    cancel_order,
    confirm_stripe,
    lock_open_session,
    place_order,
)
from app.services.views import VISIBLE_STATUSES, menu_out, order_out, session_out

router = APIRouter(prefix="/sessions/{token}", tags=["guest"])


def _session(db: Session, token: str) -> TableSession:
    s = db.scalars(select(TableSession).where(TableSession.token == token)).first()
    if s is None:
        raise HTTPException(404, "Unknown table session")
    return s


def _own_order(db: Session, session: TableSession, order_id: int) -> Order:
    order = db.get(Order, order_id)
    if order is None or order.session_id != session.id:
        raise HTTPException(404, "Unknown order")
    return order


@router.get("", response_model_exclude_none=True)
def guest_state(token: str, db: Session = Depends(get_db)) -> GuestState:
    """The session (open or closed), its orders and the menu. Unknown tokens get 404."""
    s = _session(db, token)
    orders = db.scalars(
        select(Order)
        .where(Order.session_id == s.id, Order.payment_status.in_(VISIBLE_STATUSES))
        .order_by(Order.created_at)
    ).all()
    menu = menu_out(db, include_hidden=False)
    if s.status != "open":
        # A finished visit shows only the thank-you message; no menu or orders
        return GuestState(
            session=session_out(s), orders=[], menu=menu.model_copy(update={"items": []})
        )
    return GuestState(session=session_out(s), orders=[order_out(o) for o in orders], menu=menu)


@router.post("/orders", response_model_exclude_none=True)
def create_order(token: str, body: PlaceOrderIn, db: Session = Depends(get_db)) -> PlaceOrderOut:
    """
    Pay first. "counter": the order waits for staff to take the money.
    "stripe": the order waits until the payment is confirmed; the reply has the client secret.
    """
    checkout = place_order(db, token, body.lines, body.pay)
    payment = (
        StripeCheckout(
            intent_id=checkout.intent_id,
            client_secret=checkout.client_secret,
            simulated=checkout.simulated,
        )
        if checkout.intent_id
        else None
    )
    return PlaceOrderOut(order=order_out(checkout.order), payment=payment)


@router.post("/orders/{order_id}/confirm-payment", response_model_exclude_none=True)
def confirm_payment(token: str, order_id: int, db: Session = Depends(get_db)) -> PaymentCheckOut:
    """After Stripe.js says the card went through, the server checks with Stripe itself."""
    order = _own_order(db, _session(db, token), order_id)
    status = confirm_stripe(db, order)
    return PaymentCheckOut(status=status, order=order_out(order))


@router.post("/payments/{intent_id}/confirm", response_model_exclude_none=True)
def confirm_by_intent(token: str, intent_id: str, db: Session = Depends(get_db)) -> PaymentCheckOut:
    """Same check, for guests coming back from a redirect-based payment method."""
    s = _session(db, token)
    order = db.scalars(select(Order).where(Order.stripe_intent_id == intent_id)).first()
    if order is None or order.session_id != s.id:
        raise HTTPException(404, "Unknown payment")
    status = confirm_stripe(db, order)
    return PaymentCheckOut(status=status, order=order_out(order))


@router.post("/orders/{order_id}/abandon")
def abandon_checkout(token: str, order_id: int, db: Session = Depends(get_db)) -> dict[str, bool]:
    """The guest closed the card form without paying: drop the pending order."""
    order = _own_order(db, _session(db, token), order_id)
    if order.payment_status == "pending":
        cancel_intent(order.stripe_intent_id)
        cancel_order(order)
        db.commit()
    return {"ok": True}


@router.post("/waiter")
def call_waiter(token: str, db: Session = Depends(get_db)) -> dict[str, bool]:
    s = lock_open_session(db, token)
    s.waiter_called_at = utcnow()
    db.commit()
    return {"ok": True}
