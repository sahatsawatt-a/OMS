"""Front of house: tables, sessions and orders. Every endpoint needs the staff key."""

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.core.security import require_staff
from app.db.session import get_db
from app.models import DiningTable, Order, TableSession
from app.schemas import (
    CounterPaymentIn,
    ItemStatusIn,
    OpenSessionIn,
    OrderOut,
    SessionOut,
    StaffState,
)
from app.services.orders import NEXT_STATUS, cancel_order, close_session, token
from app.services.views import (
    menu_out,
    order_out,
    session_out,
    staff_orders,
    staff_sessions,
    table_out,
)

router = APIRouter(tags=["staff"], dependencies=[Depends(require_staff)])


@router.get("/staff/check")
def check_key() -> dict[str, bool]:
    """Lets the staff screens check a key before saving it."""
    return {"ok": True}


@router.get("/staff/state", response_model_exclude_none=True)
def staff_state(
    days: int = Query(default=60, ge=1, le=400), db: Session = Depends(get_db)
) -> StaffState:
    """Tables, open sessions, recent sessions and their orders (for reports), and the full menu."""
    tables = db.scalars(select(DiningTable).order_by(DiningTable.number)).all()
    sessions = staff_sessions(db, since=utcnow() - timedelta(days=days))
    orders = staff_orders(db, [s.id for s in sessions])
    return StaffState(
        tables=[table_out(t) for t in tables],
        sessions={s.token: session_out(s) for s in sessions},
        orders=[order_out(o) for o in orders],
        menu=menu_out(db, include_hidden=True),
    )


def _open_session_for(db: Session, table_id: str) -> TableSession | None:
    return db.scalars(select(TableSession).where(TableSession.open_table_id == table_id)).first()


@router.post("/tables/{table_id}/sessions", response_model_exclude_none=True)
def seat_guests(table_id: str, body: OpenSessionIn, db: Session = Depends(get_db)) -> SessionOut:
    """Open a session (the QR code's token). A table already seated returns its open session."""
    table = db.get(DiningTable, table_id)
    if table is None:
        raise HTTPException(404, "Unknown table")
    if existing := _open_session_for(db, table_id):
        return session_out(existing)
    session = TableSession(
        token=token(),
        table_id=table.id,
        open_table_id=table.id,
        guests=body.guests,
        status="open",
        opened_at=utcnow(),
    )
    session.table = table
    db.add(session)
    try:
        db.commit()
    except IntegrityError:
        # Someone else seated this table at the same moment
        db.rollback()
        existing = _open_session_for(db, table_id)
        if existing is None:
            raise
        return session_out(existing)
    return session_out(session)


# Sessions are addressed by id, not by the QR token, so the token never appears in a URL or log
def _session(db: Session, session_id: int) -> TableSession:
    s = db.scalars(
        select(TableSession).where(TableSession.id == session_id).with_for_update()
    ).first()
    if s is None:
        raise HTTPException(404, "Unknown table session")
    return s


@router.post("/sessions/{session_id}/close")
def clear_table(session_id: int, db: Session = Depends(get_db)) -> dict[str, bool]:
    """Guests have left: the QR and every phone stop working. Refused while a counter order is
    unpaid."""
    close_session(db, _session(db, session_id))
    db.commit()
    return {"ok": True}


@router.delete("/sessions/{session_id}/waiter")
def acknowledge_waiter(session_id: int, db: Session = Depends(get_db)) -> dict[str, bool]:
    _session(db, session_id).waiter_called_at = None
    db.commit()
    return {"ok": True}


@router.delete("/sessions/{session_id}/devices/{label}")
def remove_device(session_id: int, label: str, db: Session = Depends(get_db)) -> dict[str, bool]:
    """A phone that shouldn't be at this table (e.g. someone with a photo of the QR code): its
    token stops working at once. Its paid orders stay."""
    session = _session(db, session_id)
    device = next((d for d in session.devices if d.label == label), None)
    if device is None:
        raise HTTPException(404, "Unknown phone")
    if device.removed_at is None:
        device.removed_at = utcnow()
        db.commit()
    return {"ok": True}


def _order(db: Session, order_id: int) -> Order:
    order = db.get(Order, order_id, with_for_update=True)
    if order is None or order.payment_status == "pending":
        raise HTTPException(404, "Unknown order")
    return order


@router.post("/orders/{order_id}/counter-payment", response_model_exclude_none=True)
def counter_payment(
    order_id: int, body: CounterPaymentIn, db: Session = Depends(get_db)
) -> OrderOut:
    """Staff took the money at the counter, less any discount; the order now goes through."""
    order = _order(db, order_id)
    if order.payment_status != "awaiting_counter":
        raise HTTPException(409, "This order is not waiting for payment")
    if body.discount > order.amount:
        raise HTTPException(422, "The discount is more than the bill")
    if body.card_brand and body.method != "card_terminal":
        raise HTTPException(422, "A card brand is only for card payments")
    order.discount = body.discount
    order.amount -= body.discount
    order.payment_status = "paid"
    order.payment_method = body.method
    order.card_brand = body.card_brand
    order.paid_at = utcnow()
    db.commit()
    return order_out(order)


@router.post("/orders/{order_id}/cancel", response_model_exclude_none=True)
def cancel_unpaid(order_id: int, db: Session = Depends(get_db)) -> OrderOut:
    """Cancel an order that was never paid; nothing is made."""
    order = _order(db, order_id)
    if order.payment_status != "awaiting_counter":
        raise HTTPException(409, "Only orders waiting for payment can be cancelled")
    cancel_order(order)
    db.commit()
    return order_out(order)


@router.post("/orders/{order_id}/served", response_model_exclude_none=True)
def mark_served(order_id: int, db: Session = Depends(get_db)) -> OrderOut:
    """All food of a paid order has been brought to the table."""
    order = _order(db, order_id)
    if order.payment_status != "paid":
        raise HTTPException(409, "Only paid orders are served")
    for item in order.items:
        if "served" in NEXT_STATUS[item.status]:
            item.status = "served"
    db.commit()
    return order_out(order)


@router.put("/orders/{order_id}/items/{item_id}/status", response_model_exclude_none=True)
def set_item_status(
    order_id: int, item_id: int, body: ItemStatusIn, db: Session = Depends(get_db)
) -> OrderOut:
    order = _order(db, order_id)
    item = next((i for i in order.items if i.id == item_id), None)
    if item is None:
        raise HTTPException(404, "Unknown order item")
    if body.status != item.status:
        if body.status not in NEXT_STATUS[item.status]:
            raise HTTPException(409, f"Can't go from {item.status} to {body.status}")
        if order.payment_status != "paid" and body.status != "cancelled":
            raise HTTPException(409, "Only paid orders are served")
        item.status = body.status
    db.commit()
    return order_out(order)
