"""Pay-first order rules: the server prices every order and decides when it reaches the kitchen."""

import logging
import secrets
from dataclasses import dataclass

import stripe
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.clock import business_day, utcnow
from app.core.config import get_settings
from app.models import MenuItem, Order, OrderItem, TableDevice, TableSession
from app.schemas import OrderLineIn

log = logging.getLogger(__name__)

# Allowed item status changes; no kitchen control for now, so staff mark food served
NEXT_STATUS: dict[str, set[str]] = {
    "submitted": {"served", "cancelled"},
    "served": set(),
    "cancelled": set(),
}

# Stripe's minimum charge for AUD is $0.50
MIN_STRIPE_AMOUNT = 50
# Stripe's card brands mapped to the card types the reports show (REQ-39). Apple Pay and
# Google Pay report the card behind them. Everything else (Discover, JCB, UnionPay, ...) is "other".
STRIPE_CARD_BRANDS = {
    "visa": "visa",
    "mastercard": "mastercard",
    "amex": "amex",
    "eftpos_au": "eftpos",
}
# The simulated card in the demo (no Stripe keys) stands for Stripe's 4242 Visa test card
SIMULATED_CARD_BRAND = "visa"

# Unpaid "pay at counter" orders a table may have at once, so nobody can flood the staff screen
MAX_WAITING_AT_COUNTER = 2


def token() -> str:
    """128 random bits, base64url: the secret in a table's QR code."""
    return secrets.token_urlsafe(16)


def price_lines(db: Session, lines: list[OrderLineIn]) -> tuple[list[OrderItem], int]:
    """Build order items from the menu in the database. The browser's prices are never used."""
    ids = {line.menu_item_id for line in lines}
    menu = {m.id: m for m in db.scalars(select(MenuItem).where(MenuItem.id.in_(ids))).all()}

    unavailable = [
        (menu[i].name if i in menu else i)
        for i in ids
        if i not in menu or menu[i].hidden or menu[i].sold_out
    ]
    if unavailable:
        raise HTTPException(409, f"No longer available: {', '.join(sorted(unavailable))}")

    items: list[OrderItem] = []
    for line in lines:
        dish: MenuItem = menu[line.menu_item_id]
        groups = {g.id: g for g in dish.option_groups}
        picked: dict[str, list[str]] = {}
        for opt in line.options:
            if opt.group_id not in groups:
                raise HTTPException(422, f"{dish.name} has no option group {opt.group_id}")
            picked.setdefault(opt.group_id, [])
            if opt.choice_id in picked[opt.group_id]:
                raise HTTPException(422, f"{dish.name}: option chosen twice")
            picked[opt.group_id].append(opt.choice_id)

        options: list[dict] = []
        for group in dish.option_groups:
            chosen = picked.get(group.id, [])
            if group.type == "single" and len(chosen) != 1:
                raise HTTPException(422, f"{dish.name}: pick one {group.name.lower()}")
            choices = {c.id: c for c in group.choices}
            for choice_id in chosen:
                if choice_id not in choices:
                    raise HTTPException(422, f"{dish.name}: unknown {group.name.lower()} choice")
                c = choices[choice_id]
                options.append(
                    {
                        "groupId": group.id,
                        "choiceId": c.id,
                        "groupName": group.name,
                        "choiceName": c.name,
                        "price": c.price,
                    }
                )

        items.append(
            OrderItem(
                menu_item_id=dish.id,
                name=dish.name,
                unit_price=dish.price + sum(o["price"] for o in options),
                quantity=line.quantity,
                options=options,
                note=line.note.strip(),
                status="submitted",
            )
        )
    return items, sum(i.unit_price * i.quantity for i in items)


def lock_open_session(db: Session, session_id: int) -> TableSession:
    """The guest's table, which must be open. Locked so orders on one table are numbered in turn."""
    s = db.scalars(
        select(TableSession).where(TableSession.id == session_id).with_for_update()
    ).first()
    if s is None:
        raise HTTPException(404, "Unknown table session")
    if s.status != "open":
        raise HTTPException(410, "This table's visit has ended. Please ask our staff.")
    return s


def make_visible(db: Session, order: Order) -> None:
    """Give the order its round at the table and its number for the day (from 101)."""
    if order.number is not None:
        return
    order.round = (
        db.scalar(
            select(func.count(Order.id)).where(
                Order.session_id == order.session_id,
                Order.number.is_not(None),
                Order.id != order.id,
            )
        )
        or 0
    ) + 1
    day = business_day(utcnow())
    # FOR UPDATE takes InnoDB next-key locks on that day's range, so two orders can't take
    # the same number; the unique key on (business_day, number) backs it up
    last = db.scalar(
        select(func.max(Order.number)).where(Order.business_day == day).with_for_update()
    )
    order.business_day = day
    order.number = (last or 100) + 1


@dataclass
class Checkout:
    order: Order
    intent_id: str | None = None
    client_secret: str | None = None
    simulated: bool = False


def place_order(db: Session, device: TableDevice, lines: list[OrderLineIn], pay: str) -> Checkout:
    session = lock_open_session(db, device.session_id)
    if pay == "counter":
        waiting = db.scalar(
            select(func.count(Order.id)).where(
                Order.session_id == session.id, Order.payment_status == "awaiting_counter"
            )
        )
        if (waiting or 0) >= MAX_WAITING_AT_COUNTER:
            raise HTTPException(
                409,
                f"This table already has {MAX_WAITING_AT_COUNTER} orders waiting for payment at "
                "the counter. Please pay for those first, or pay on your phone.",
            )
    items, amount = price_lines(db, lines)
    now = utcnow()
    order = Order(
        session_id=session.id,
        device_id=device.id,
        table_number=session.table.number,
        round=0,
        created_at=now,
        amount=amount,
        currency="aud",
        payment_status="awaiting_counter" if pay == "counter" else "pending",
        items=items,
    )
    db.add(order)
    db.flush()

    if pay == "counter":
        make_visible(db, order)
        db.commit()
        return Checkout(order=order)

    settings = get_settings()
    if not settings.stripe_enabled:
        if not settings.demo_mode:
            raise HTTPException(503, "Card payments are not available right now")
        order.stripe_intent_id = f"sim_{order.id}_{secrets.token_hex(6)}"
        db.commit()
        return Checkout(order=order, intent_id=order.stripe_intent_id, simulated=True)

    if amount < MIN_STRIPE_AMOUNT:
        raise HTTPException(422, "Orders under $0.50 can only be paid at the counter")
    try:
        intent = stripe.PaymentIntent.create(
            amount=amount,
            currency="aud",
            automatic_payment_methods={"enabled": True},
            description=f"Table {order.table_number} order",
            metadata={
                "order_id": str(order.id),
                "table_number": str(order.table_number),
                # Never the QR token: it is the table's key
                "session_id": str(session.id),
                "device": device.label,
            },
            # Order ids repeat across databases sharing one Stripe account (a test stack, the
            # demo, a restored backup), and Stripe answers a reused key with the payment it made
            # the first time, possibly one already paid. The random part keeps every order's
            # key its own; Stripe's own retries of this one call still reuse it.
            idempotency_key=f"oms-order-{order.id}-{secrets.token_hex(8)}",
        )
    except stripe.StripeError as exc:
        db.rollback()
        raise HTTPException(502, exc.user_message or "Could not start the card payment") from exc
    if intent.status != "requires_payment_method":
        # Not a fresh payment: never let an old one pay for this order
        log.error(
            "New PaymentIntent %s for order %s is already %s", intent.id, order.id, intent.status
        )
        db.rollback()
        raise HTTPException(502, "Could not start the card payment")
    order.stripe_intent_id = intent.id
    db.commit()
    return Checkout(order=order, intent_id=intent.id, client_secret=intent.client_secret)


def _field(obj, key: str):
    """Stripe objects are dicts; tests use plain objects."""
    if obj is None:
        return None
    return obj.get(key) if isinstance(obj, dict) else getattr(obj, key, None)


def card_brand_of(intent) -> str | None:
    """The card type behind a succeeded PaymentIntent, read from its charge; None if unknown."""
    charge = _field(intent, "latest_charge")
    if isinstance(charge, str):
        # Not expanded (e.g. in a webhook event): fetch the charge
        try:
            charge = stripe.Charge.retrieve(charge)
        except stripe.StripeError:
            log.warning("Could not read the card type of %s", _field(intent, "id"))
            return None
    details = _field(charge, "payment_method_details")
    if details is None:
        return None
    if _field(details, "type") not in ("card", "card_present"):
        # Paid another way (e.g. a buy-now-pay-later method)
        return "other"
    card = _field(details, "card") or _field(details, "card_present")
    brand = _field(card, "brand")
    return STRIPE_CARD_BRANDS.get(brand, "other") if brand else None


def mark_paid(db: Session, order: Order, method: str, card_brand: str | None = None) -> None:
    """Idempotent: a webhook and the guest's own check may both arrive."""
    if order.payment_status == "paid":
        if card_brand and not order.card_brand:
            order.card_brand = card_brand
        return
    if order.payment_status == "cancelled":
        # Stripe took the money after the order was dropped (e.g. table cleared mid-payment).
        # Record it so the payment is not lost; staff can refund it.
        log.warning("Payment succeeded for cancelled order %s", order.id)
        for item in order.items:
            item.status = "submitted"
        order.cancelled_at = None
    order.payment_status = "paid"
    order.payment_method = method
    order.card_brand = card_brand
    order.paid_at = utcnow()
    make_visible(db, order)


def confirm_stripe(db: Session, order: Order) -> str:
    """Ask Stripe (not the browser) whether the order's payment went through."""
    if order.payment_status == "paid":
        return "succeeded"
    intent_id = order.stripe_intent_id or ""
    if intent_id.startswith("sim_"):
        # Demo without Stripe keys: the simulated card always succeeds
        mark_paid(db, order, "stripe", SIMULATED_CARD_BRAND)
        db.commit()
        return "succeeded"
    if not intent_id.startswith("pi_"):
        raise HTTPException(409, "This order is not paid on the phone")
    try:
        # The charge says which card paid (REQ-39)
        intent = stripe.PaymentIntent.retrieve(intent_id, expand=["latest_charge"])
    except stripe.StripeError as exc:
        raise HTTPException(502, "Could not reach Stripe") from exc
    if intent.status == "succeeded":
        check_intent_matches(order, intent)
        mark_paid(db, order, "stripe", card_brand_of(intent))
        db.commit()
    return intent.status


def check_intent_matches(order: Order, intent) -> None:
    metadata = intent.metadata or {}
    if (
        intent.amount != order.amount
        or intent.currency != order.currency
        or metadata.get("order_id") != str(order.id)
    ):
        log.error("PaymentIntent %s does not match order %s", intent.id, order.id)
        raise HTTPException(409, "Payment does not match the order")


def cancel_intent(intent_id: str | None) -> None:
    """Best effort: stop a started card payment for an order that is being dropped."""
    if not intent_id or not intent_id.startswith("pi_") or not get_settings().stripe_secret_key:
        return
    try:
        stripe.PaymentIntent.cancel(intent_id)
    except stripe.StripeError:
        log.info("Could not cancel PaymentIntent %s", intent_id)


def cancel_order(order: Order) -> None:
    order.payment_status = "cancelled"
    order.cancelled_at = utcnow()
    for item in order.items:
        item.status = "cancelled"


def close_session(db: Session, session: TableSession) -> None:
    if session.status != "open":
        return
    statuses = db.scalars(
        select(Order).where(
            Order.session_id == session.id,
            Order.payment_status.in_(("awaiting_counter", "pending")),
        )
    ).all()
    if any(o.payment_status == "awaiting_counter" for o in statuses):
        raise HTTPException(
            409, "An order at this table is still waiting for payment at the counter"
        )
    for o in statuses:
        cancel_intent(o.stripe_intent_id)
        cancel_order(o)
    session.status = "closed"
    session.closed_at = utcnow()
    session.open_table_id = None
    session.waiter_called_at = None
