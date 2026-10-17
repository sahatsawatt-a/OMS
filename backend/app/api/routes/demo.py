"""Demo-only helpers behind the staff key: start over with sample tables, or an empty floor."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import require_staff
from app.db.session import get_db
from app.seed import clear_service, seed_service

router = APIRouter(prefix="/demo", tags=["demo"], dependencies=[Depends(require_staff)])


def _demo_only() -> None:
    if not get_settings().demo_mode:
        raise HTTPException(404, "Not found")


@router.post("/reset", dependencies=[Depends(_demo_only)])
def reset(db: Session = Depends(get_db)) -> dict[str, bool]:
    """Back to the sample tables and orders; the menu is kept."""
    clear_service(db)
    seed_service(db)
    db.commit()
    return {"ok": True}


@router.post("/clear", dependencies=[Depends(_demo_only)])
def clear(db: Session = Depends(get_db)) -> dict[str, bool]:
    """No tables seated, no orders; the menu is kept."""
    clear_service(db)
    db.commit()
    return {"ok": True}
