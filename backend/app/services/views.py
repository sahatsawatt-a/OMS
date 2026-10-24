"""Database rows to API shapes."""

from datetime import datetime

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.clock import to_ms
from app.models import DiningTable, MenuCategory, MenuItem, OptionGroup, Order, TableSession
from app.schemas import (
    CategoryOut,
    DeviceOut,
    GuestSessionOut,
    MenuItemOut,
    MenuOut,
    OptionGroupOut,
    OrderItemOut,
    OrderOut,
    OrderPaymentOut,
    SelectedOptionOut,
    SessionOut,
    TableOut,
)

# Orders staff see: pending Stripe checkouts are not orders yet
VISIBLE_STATUSES = ("awaiting_counter", "paid", "cancelled")


def group_out(g: OptionGroup) -> OptionGroupOut:
    return OptionGroupOut.model_validate(g)


def item_out(m: MenuItem) -> MenuItemOut:
    return MenuItemOut(
        id=m.id,
        category_id=m.category_id,
        number=m.number,
        name=m.name,
        name_th=m.name_th or None,
        description=m.description,
        price=m.price,
        image=m.image or None,
        recommended=m.recommended or None,
        option_groups=[group_out(g) for g in m.option_groups],
        dietary=list(m.dietary or []),
        allergens=list(m.allergens or []),
        hidden=m.hidden or None,
    )


def menu_out(db: Session, include_hidden: bool) -> MenuOut:
    categories = db.scalars(select(MenuCategory).order_by(MenuCategory.sort_order)).all()
    q = select(MenuItem).order_by(MenuItem.sort_order, MenuItem.name)
    if not include_hidden:
        q = q.where(MenuItem.hidden.is_(False))
    items = db.scalars(q).all()
    groups = db.scalars(select(OptionGroup).order_by(OptionGroup.sort_order)).all()
    return MenuOut(
        categories=[CategoryOut.model_validate(c) for c in categories],
        items=[item_out(m) for m in items],
        option_groups=[group_out(g) for g in groups],
        sold_out=[m.id for m in items if m.sold_out],
    )


def table_out(t: DiningTable) -> TableOut:
    return TableOut.model_validate(t)


def session_out(s: TableSession) -> SessionOut:
    """Staff view, with the QR token and the phones that joined."""
    return SessionOut(
        id=s.id,
        token=s.token,
        table_id=s.table_id,
        table_number=s.table.number,
        guests=s.guests,
        status=s.status,
        opened_at=to_ms(s.opened_at),
        closed_at=to_ms(s.closed_at),
        waiter_called_at=to_ms(s.waiter_called_at),
        devices=[
            DeviceOut(label=d.label, joined_at=to_ms(d.joined_at), removed_at=to_ms(d.removed_at))
            for d in s.devices
        ],
    )


def guest_session_out(s: TableSession) -> GuestSessionOut:
    """Guest view: no QR token, so a phone staff removed can't use it to join again."""
    return GuestSessionOut(
        table_number=s.table.number,
        guests=s.guests,
        status=s.status,
        opened_at=to_ms(s.opened_at),
        closed_at=to_ms(s.closed_at),
        waiter_called_at=to_ms(s.waiter_called_at),
    )


def order_out(o: Order, staff: bool = True) -> OrderOut:
    return OrderOut(
        id=str(o.id),
        number=o.number,
        session_token=o.session.token if staff else None,
        device=o.device.label if o.device else None,
        table_number=o.table_number,
        round=o.round,
        created_at=to_ms(o.created_at),
        items=[
            OrderItemOut(
                id=str(i.id),
                menu_item_id=i.menu_item_id,
                name=i.name,
                unit_price=i.unit_price,
                quantity=i.quantity,
                options=[SelectedOptionOut.model_validate(opt) for opt in i.options or []],
                note=i.note,
                status=i.status,
            )
            for i in o.items
        ],
        payment=OrderPaymentOut(
            status=o.payment_status,
            amount=o.amount,
            method=o.payment_method,
            discount=o.discount or None,
            card_brand=o.card_brand,
            paid_at=to_ms(o.paid_at),
            cancelled_at=to_ms(o.cancelled_at),
            intent_id=o.stripe_intent_id,
        ),
    )


def staff_sessions(db: Session, since: datetime) -> list[TableSession]:
    """Open sessions, plus any session opened since `since` (for reports)."""
    q = select(TableSession).where(
        or_(TableSession.status == "open", TableSession.opened_at >= since)
    )
    return list(db.scalars(q.order_by(TableSession.opened_at)).all())


def staff_orders(db: Session, session_ids: list[int]) -> list[Order]:
    if not session_ids:
        return []
    q = (
        select(Order)
        .where(Order.session_id.in_(session_ids), Order.payment_status.in_(VISIBLE_STATUSES))
        .order_by(Order.created_at)
    )
    return list(db.scalars(q).all())
