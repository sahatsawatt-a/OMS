from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.tables import TableDevice, TableSession


class Order(Base):
    """
    Pay first: an order reaches the kitchen only once paid.

    payment_status:
      pending          Stripe payment started, not confirmed yet; not shown to staff
      awaiting_counter guest chose "Pay at counter"; staff have not taken the money yet
      paid             paid by Stripe, card terminal or cash
      cancelled        never paid, nothing was made
    """

    __tablename__ = "orders"
    __table_args__ = (UniqueConstraint("business_day", "number", name="uq_orders_day_number"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("table_sessions.id"), index=True)
    # The phone that placed it; empty for orders from before phones had their own ids
    device_id: Mapped[int | None] = mapped_column(
        ForeignKey("table_devices.id"), index=True, nullable=True
    )
    table_number: Mapped[int] = mapped_column(Integer)
    round: Mapped[int] = mapped_column(Integer)
    # Short number read out at the counter, from 101 each day; given once the order is visible
    business_day: Mapped[date | None] = mapped_column(Date, nullable=True)
    number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, index=True)

    # What was actually paid; the bill before any counter discount is amount + discount
    amount: Mapped[int] = mapped_column(Integer)
    discount: Mapped[int] = mapped_column(Integer, default=0)
    currency: Mapped[str] = mapped_column(String(3), default="aud")
    payment_status: Mapped[str] = mapped_column(String(20), index=True)
    payment_method: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # Counter card payments only, for the record: staff note what the terminal showed
    card_brand: Mapped[str | None] = mapped_column(String(20), nullable=True)
    stripe_intent_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    session: Mapped[TableSession] = relationship(lazy="joined")
    device: Mapped[TableDevice | None] = relationship(lazy="joined")
    items: Mapped[list["OrderItem"]] = relationship(
        order_by="OrderItem.id", cascade="all, delete-orphan", lazy="selectin"
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    menu_item_id: Mapped[str] = mapped_column(String(64), index=True)
    # Name, options and price as they were when ordered
    name: Mapped[str] = mapped_column(String(160))
    unit_price: Mapped[int] = mapped_column(Integer)
    quantity: Mapped[int] = mapped_column(Integer)
    options: Mapped[list[dict]] = mapped_column(JSON, default=list)
    note: Mapped[str] = mapped_column(String(500), default="")
    status: Mapped[str] = mapped_column(String(20), default="submitted")
