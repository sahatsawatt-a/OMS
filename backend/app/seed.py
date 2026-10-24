"""
Sample data for Ying Thai 2: menu, tables, and (demo only) seated tables with orders.

Run `python -m app.seed` after migrations; it only fills an empty database.
The menu is Ying Thai 2's own (app/menu_data.py).
"""

from datetime import timedelta

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.menu_data import CATEGORIES, DEFAULT_SOLD_OUT, DISHES, OPTION_GROUPS
from app.models import (
    DiningTable,
    MenuCategory,
    MenuItem,
    MenuItemOptionGroup,
    OptionChoice,
    OptionGroup,
    Order,
    OrderItem,
    TableDevice,
    TableSession,
)
from app.services.orders import make_visible, token

TABLES = [
    ("t1", 1, 2, "Window"),
    ("t2", 2, 2, "Window"),
    ("t3", 3, 4, "Main"),
    ("t4", 4, 4, "Main"),
    ("t5", 5, 4, "Main"),
    ("t6", 6, 6, "Main"),
    ("t7", 7, 8, "Terrace"),
    ("t8", 8, 4, "Terrace"),
]


def seed_tables(db: Session) -> None:
    for id_, number, seats, zone in TABLES:
        db.merge(DiningTable(id=id_, number=number, seats=seats, zone=zone))


def _get_or_add(db: Session, model, key, **fields):
    row = db.get(model, key)
    if row is None:
        row = model(**fields)
        db.add(row)
    else:
        for name, value in fields.items():
            setattr(row, name, value)
    return row


def seed_menu(db: Session) -> None:
    """Put the sample menu in place (insert or overwrite the sample rows)."""
    for i, (id_, name, name_th) in enumerate(CATEGORIES):
        _get_or_add(db, MenuCategory, id_, id=id_, name=name, name_th=name_th, sort_order=i)
    for i, (id_, name, type_, choices) in enumerate(OPTION_GROUPS):
        group = _get_or_add(db, OptionGroup, id_, id=id_, name=name, type=type_, sort_order=i)
        group.choices = [
            _get_or_add(
                db,
                OptionChoice,
                (id_, cid),
                group_id=id_,
                id=cid,
                name=cname,
                price=price,
                sort_order=j,
            )
            for j, (cid, cname, price) in enumerate(choices)
        ]
    db.flush()
    for i, d in enumerate(DISHES):
        dish = _get_or_add(
            db,
            MenuItem,
            d.id,
            id=d.id,
            number=d.number,
            category_id=d.category,
            name=d.name,
            name_th=d.name_th or None,
            description=d.description,
            price=d.price,
            image=d.image,
            recommended=d.recommended,
            dietary=d.dietary,
            allergens=d.allergens,
            hidden=False,
            sold_out=d.id in DEFAULT_SOLD_OUT,
            sort_order=i,
        )
        set_option_groups(db, dish, d.options)
    db.flush()


def set_option_groups(db: Session, dish: MenuItem, group_ids: list[str]) -> None:
    """Replace a dish's option groups, keeping link rows that stay."""
    links = []
    for j, g in enumerate(group_ids):
        link = db.get(MenuItemOptionGroup, (dish.id, g)) if dish.id else None
        if link is None:
            link = MenuItemOptionGroup(item_id=dish.id, group_id=g)
        link.sort_order = j
        links.append(link)
    dish.option_links = links


def reset_menu(db: Session) -> None:
    """Back to the sample menu. Dishes added since are deleted, or hidden if they were ordered."""
    sample_ids = {d.id for d in DISHES}
    ordered = set(db.scalars(select(OrderItem.menu_item_id).distinct()).all())
    for m in db.scalars(select(MenuItem)).all():
        if m.id in sample_ids:
            continue
        if m.id in ordered:
            m.hidden = True
            m.sold_out = False
        else:
            db.delete(m)
    db.flush()
    seed_menu(db)
    db.execute(update(MenuItem).values(sold_out=False))
    # Categories added since: keep only those still holding (hidden) dishes
    used = set(db.scalars(select(MenuItem.category_id).distinct()).all())
    sample_cats = {c[0] for c in CATEGORIES}
    extra = db.scalars(select(MenuCategory).where(MenuCategory.id.not_in(sample_cats))).all()
    for c in extra:
        if c.id not in used:
            db.delete(c)
    db.flush()


def clear_service(db: Session) -> None:
    """Demo only: remove every table session and order."""
    db.execute(delete(OrderItem))
    db.execute(delete(Order))
    # Phones belong to sessions (and orders to phones), so they go in between
    db.execute(delete(TableDevice))
    db.execute(delete(TableSession))
    db.flush()


def seed_service(db: Session) -> None:
    """Demo only: tables 2, 3, 5, 6 and 7 seated, orders at every stage (as demo/seed.ts)."""
    now = utcnow()
    tables = {t.number: t for t in db.scalars(select(DiningTable)).all()}
    menu = {m.id: m for m in db.scalars(select(MenuItem)).all()}

    def ago(minutes: float):
        return now - timedelta(minutes=minutes)

    def seat(number: int, guests: int, minutes_ago: float, closed_minutes_ago=None, waiter=None):
        t = tables[number]
        s = TableSession(
            token=token(),
            table_id=t.id,
            open_table_id=None if closed_minutes_ago else t.id,
            guests=guests,
            status="closed" if closed_minutes_ago else "open",
            opened_at=ago(minutes_ago),
            closed_at=ago(closed_minutes_ago) if closed_minutes_ago else None,
            waiter_called_at=ago(waiter) if waiter else None,
        )
        s.table = t
        db.add(s)
        db.flush()
        return s

    def item(menu_id: str, qty: int, status: str, choices=(), note=""):
        dish = menu[menu_id]
        options = [
            {
                "groupId": g.id,
                "choiceId": c.id,
                "groupName": g.name,
                "choiceName": c.name,
                "price": c.price,
            }
            for g in dish.option_groups
            for c in g.choices
            if c.name in choices
        ]
        return OrderItem(
            menu_item_id=dish.id,
            name=dish.name,
            unit_price=dish.price + sum(o["price"] for o in options),
            quantity=qty,
            options=options,
            note=note,
            status=status,
        )

    placed: list[tuple] = []

    def order(session, minutes_ago, pay, items, card=None):
        # card: the card type for card payments (REQ-39)
        placed.append((session, minutes_ago, pay, items, card))

    t1 = seat(1, 2, 95, closed_minutes_ago=40)
    order(
        t1,
        90,
        "card_terminal",
        [
            item("som-tum", 1, "served", ["Thai style"]),
            item("pineapple-fried-rice", 2, "served"),
            item("ice-lemon-tea", 2, "served"),
        ],
        card="mastercard",
    )

    t2 = seat(2, 2, 8, waiter=1)
    order(
        t2,
        4,
        "stripe",
        [
            item("pad-thai", 1, "submitted", ["Prawns"]),
            item("pud-see-ew", 1, "submitted", ["Chicken"]),
            item("iced-tea", 2, "submitted", ["Ice milk tea", "Standard"]),
        ],
        card="visa",
    )

    t3 = seat(3, 4, 38)
    order(
        t3,
        34,
        "stripe",
        [
            item("mixed-entree", 1, "served"),
            item("satay", 1, "served", ["Chicken"]),
            item("soft-drink", 2, "served", ["Coke"]),
            item("iced-tea", 2, "served", ["Ice milk tea", "Standard"]),
        ],
        card="amex",
    )
    order(
        t3,
        14,
        "card_terminal",
        [
            item("gang-keaw-waan", 1, "submitted", ["Chicken"]),
            item("pad-grapow", 2, "submitted", ["Minced pork"], "fried egg on top"),
            item("jasmine-rice", 3, "submitted"),
        ],
        card="eftpos",
    )

    t5 = seat(5, 3, 12)
    order(
        t5,
        5,
        "counter",
        [
            item("tom-yum-seafood", 1, "submitted", ["Prawn", "Hot pot"]),
            item("pineapple-fried-rice", 1, "submitted"),
            item("soft-drink", 3, "submitted", ["Coke Zero"]),
        ],
    )

    t6 = seat(6, 5, 20)
    order(t6, 17, "cash", [item("ice-lemon-tea", 3, "served"), item("orange-juice", 2, "served")])
    order(t6, 12, "cancelled", [item("gouy-teaw-nuer", 1, "cancelled")])
    order(
        t6,
        6,
        "stripe",
        [
            item("pad-thai", 2, "submitted", ["Chicken"]),
            item("tom-yum", 1, "submitted", ["Chicken", "Bowl"]),
            item("som-tum", 1, "submitted", ["Mixed"], "less chilli"),
        ],
        card="visa",
    )

    seat(7, 6, 2)

    # Numbered in the order they were placed
    for session, minutes_ago, pay, items, card in sorted(placed, key=lambda p: -p[1]):
        created = ago(minutes_ago)
        o = Order(
            session_id=session.id,
            table_number=session.table.number,
            round=0,
            created_at=created,
            amount=sum(i.unit_price * i.quantity for i in items),
            currency="aud",
            payment_status={"counter": "awaiting_counter", "cancelled": "cancelled"}.get(
                pay, "paid"
            ),
            payment_method=pay if pay not in ("counter", "cancelled") else None,
            card_brand=card,
            paid_at=created + timedelta(minutes=1) if pay not in ("counter", "cancelled") else None,
            cancelled_at=created + timedelta(minutes=4) if pay == "cancelled" else None,
            items=items,
        )
        o.session = session
        db.add(o)
        db.flush()
        make_visible(db, o)
        db.flush()


def seed_if_empty(db: Session, with_service: bool) -> bool:
    if db.scalar(select(func.count()).select_from(MenuCategory)):
        return False
    seed_tables(db)
    seed_menu(db)
    if with_service:
        seed_service(db)
    db.commit()
    return True


def replace_all(db: Session) -> None:
    """Demo only: drop every table session, order and dish, then load the menu and sample tables."""
    clear_service(db)
    for model in (MenuItemOptionGroup, MenuItem, OptionChoice, OptionGroup, MenuCategory):
        db.execute(delete(model))
    db.flush()
    seed_tables(db)
    seed_menu(db)
    seed_service(db)
    db.commit()


if __name__ == "__main__":
    import sys

    from app.core.config import get_settings
    from app.db.session import SessionLocal

    with SessionLocal() as session:
        if "--replace" in sys.argv:
            if not get_settings().demo_mode:
                sys.exit("--replace deletes all orders; it only runs with DEMO_MODE=true")
            replace_all(session)
            print("Replaced the menu, tables and orders with the sample data")
        else:
            created = seed_if_empty(session, with_service=get_settings().demo_mode)
            print("Seeded sample data" if created else "Database already has data; seed skipped")
