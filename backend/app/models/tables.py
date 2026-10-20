from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class DiningTable(Base):
    __tablename__ = "dining_tables"

    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    number: Mapped[int] = mapped_column(Integer, unique=True)
    seats: Mapped[int] = mapped_column(Integer)
    zone: Mapped[str] = mapped_column(String(60), default="")


class TableSession(Base):
    """One seating at one table, from guests sitting down until staff clear the table."""

    __tablename__ = "table_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # The QR code's secret: 128 random bits, base64url
    token: Mapped[str] = mapped_column(String(64), unique=True)
    table_id: Mapped[str] = mapped_column(ForeignKey("dining_tables.id"), index=True)
    # Equal to table_id while open and NULL once closed; the unique key allows only one open
    # session per table (MySQL has no partial indexes, and NULLs never collide)
    open_table_id: Mapped[str | None] = mapped_column(String(16), unique=True, nullable=True)
    guests: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(10), default="open")
    opened_at: Mapped[datetime] = mapped_column(DateTime)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    waiter_called_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    table: Mapped[DiningTable] = relationship(lazy="joined")
    devices: Mapped[list["TableDevice"]] = relationship(
        order_by="TableDevice.id", lazy="selectin", back_populates="session"
    )


class TableDevice(Base):
    """
    One phone at a table: A, B, C... in the order they joined (REQ-37).

    A phone joins once with the QR code's token and from then on uses its own token, kept in
    its browser, so the QR token never has to stay on the phone or in a URL (REQ-36).
    """

    __tablename__ = "table_devices"
    __table_args__ = (UniqueConstraint("session_id", "label", name="uq_table_devices_label"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("table_sessions.id"), index=True)
    label: Mapped[str] = mapped_column(String(3))
    # 128 random bits, base64url
    token: Mapped[str] = mapped_column(String(64), unique=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime)
    # Staff removed this phone; its token no longer works
    removed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    session: Mapped[TableSession] = relationship(lazy="joined", back_populates="devices")
