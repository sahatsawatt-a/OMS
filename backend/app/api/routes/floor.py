"""The floor plan (Admin > Tables): where each table sits, and landmarks to find them by."""

import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, exists, select
from sqlalchemy.orm import Session

from app.core.security import require_admin
from app.db.session import get_db
from app.models import DiningTable, FloorFixture, TableSession
from app.schemas import FLOOR_COLS, FLOOR_ROWS, FixtureOut, FloorIn, FloorOut
from app.services.views import table_out

router = APIRouter(prefix="/floor", tags=["floor plan"], dependencies=[Depends(require_admin)])
admin = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@admin.get("/check")
def check_admin() -> dict[str, bool]:
    """Lets the admin screens check a key before saving it (a staff key gets 403)."""
    return {"ok": True}


def floor_out(db: Session) -> FloorOut:
    tables = db.scalars(select(DiningTable).order_by(DiningTable.number)).all()
    fixtures = db.scalars(select(FloorFixture).order_by(FloorFixture.id)).all()
    return FloorOut(
        tables=[table_out(t) for t in tables],
        fixtures=[FixtureOut.model_validate(f) for f in fixtures],
    )


@router.put("")
def save_floor(body: FloorIn, db: Session = Depends(get_db)) -> FloorOut:
    """Replace the floor plan: tables are added, moved, changed or removed, landmarks replaced.
    A table with visits on record can't be removed, so past orders keep their table."""
    for thing in [*body.tables, *body.fixtures]:
        if thing.x + thing.w > FLOOR_COLS or thing.y + thing.h > FLOOR_ROWS:
            raise HTTPException(422, "Everything must fit inside the floor plan")
    numbers = [t.number for t in body.tables]
    if len(set(numbers)) != len(numbers):
        raise HTTPException(422, "Two tables have the same number")

    existing = {t.id: t for t in db.scalars(select(DiningTable)).all()}
    kept = {t.id for t in body.tables if t.id}
    if unknown := kept - existing.keys():
        raise HTTPException(422, f"Unknown tables: {', '.join(sorted(unknown))}")
    for table_id in existing.keys() - kept:
        if db.scalar(select(exists().where(TableSession.table_id == table_id))):
            number = existing[table_id].number
            raise HTTPException(409, f"Table {number} has visits on record, so it can't be removed")
        db.delete(existing.pop(table_id))

    # Numbers are unique: park the kept tables on temporary numbers so two can swap
    for i, table in enumerate(existing.values(), start=1):
        table.number = -i
    db.flush()
    for t in body.tables:
        table = existing.get(t.id) if t.id else None
        if table is None:
            new_id = f"t{t.number}"
            if new_id in existing or db.get(DiningTable, new_id):
                new_id = f"t{secrets.token_hex(3)}"
            table = DiningTable(id=new_id)
            db.add(table)
            existing[new_id] = table
        table.number, table.seats, table.zone = t.number, t.seats, t.zone.strip()
        table.x, table.y, table.w, table.h, table.shape = t.x, t.y, t.w, t.h, t.shape

    db.execute(delete(FloorFixture))
    for f in body.fixtures:
        db.add(FloorFixture(zone=f.zone.strip(), label=f.label.strip(), x=f.x, y=f.y, w=f.w, h=f.h))
    db.commit()
    return floor_out(db)
