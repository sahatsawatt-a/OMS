"""Phones at a table (REQ-36, REQ-37).

A phone joins once with the QR code's token and gets its own device token and a letter
(A, B, C, ...). Every guest call after that sends the device token in the X-Device-Token header,
so neither token ever appears in a URL.
"""

from fastapi import Depends, Header, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.db.session import get_db
from app.models import TableDevice, TableSession
from app.services.orders import token

# A table rarely has more than a handful of phones; this only stops a script making thousands
MAX_DEVICES_PER_SESSION = 50

GONE = "This table's visit has ended. Please ask our staff."
REMOVED = "This phone was removed from the table. Please ask our staff."


def label_for(n: int) -> str:
    """0 -> A, 25 -> Z, 26 -> AA, ..."""
    label = ""
    n += 1
    while n:
        n, rest = divmod(n - 1, 26)
        label = chr(ord("A") + rest) + label
    return label


def join(db: Session, session_token: str, device_token: str | None) -> TableDevice:
    """This phone at the table: the device it already has, or a new one with the next letter."""
    session = db.scalars(
        select(TableSession).where(TableSession.token == session_token).with_for_update()
    ).first()
    if session is None:
        raise HTTPException(404, "This QR code is not valid. Please ask our staff.")
    if session.status != "open":
        raise HTTPException(410, GONE)

    if device_token:
        mine = db.scalars(
            select(TableDevice).where(
                TableDevice.token == device_token, TableDevice.session_id == session.id
            )
        ).first()
        if mine is not None:
            if mine.removed_at is not None:
                raise HTTPException(403, REMOVED)
            return mine

    # The session row is locked, so two phones joining at once get different letters
    count = db.scalar(
        select(func.count(TableDevice.id)).where(TableDevice.session_id == session.id)
    )
    if (count or 0) >= MAX_DEVICES_PER_SESSION:
        raise HTTPException(429, "Too many phones have joined this table. Please ask our staff.")
    device = TableDevice(
        session_id=session.id, label=label_for(count or 0), token=token(), joined_at=utcnow()
    )
    db.add(device)
    db.commit()
    return device


def find_device(db: Session, device_token: str | None) -> TableDevice:
    if not device_token:
        raise HTTPException(401, "Scan the QR code on your table to start ordering.")
    device = db.scalars(select(TableDevice).where(TableDevice.token == device_token)).first()
    if device is None:
        raise HTTPException(401, "Scan the QR code on your table to start ordering.")
    if device.removed_at is not None:
        raise HTTPException(403, REMOVED)
    return device


def current_device(
    x_device_token: str | None = Header(default=None), db: Session = Depends(get_db)
) -> TableDevice:
    """Guest endpoints: the phone making the call."""
    return find_device(db, x_device_token)
