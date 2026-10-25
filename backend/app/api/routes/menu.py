import re
import secrets
import unicodedata

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import exists, func, select
from sqlalchemy.orm import Session

from app.core.security import require_admin, require_staff
from app.db.session import get_db
from app.models import MenuCategory, MenuItem, MenuPhoto, OptionGroup, OrderItem
from app.schemas import CategoryIn, CreatedId, FlagIn, MenuItemIn, MenuItemOut, MenuOut, MoveIn
from app.seed import reset_menu, set_option_groups
from app.services.photos import store_photo
from app.services.views import item_out, menu_out

router = APIRouter(prefix="/menu", tags=["menu"])
# Changing the menu is for admins; marking a dish sold out during service is for any staff
admin = APIRouter(prefix="/menu", tags=["menu admin"], dependencies=[Depends(require_admin)])
staff = APIRouter(prefix="/menu", tags=["menu"], dependencies=[Depends(require_staff)])

ID_PATTERN = r"^[a-z0-9][a-z0-9-]{0,63}$"


def slug(text: str) -> str:
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", ascii_text).strip("-")[:40]


@router.get("", response_model_exclude_none=True)
def get_menu(db: Session = Depends(get_db)) -> MenuOut:
    """The menu guests see: hidden dishes left out. Public, like a printed menu."""
    return menu_out(db, include_hidden=False)


@router.get("/photos/{photo_id}")
def get_photo(photo_id: str, db: Session = Depends(get_db)) -> Response:
    """An uploaded dish photo. Its id is a hash of the bytes, so browsers may keep it for good."""
    photo = db.get(MenuPhoto, photo_id)
    if photo is None:
        raise HTTPException(404, "Unknown photo")
    return Response(
        photo.data,
        media_type=photo.content_type,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


@admin.get("/all", response_model_exclude_none=True)
def get_full_menu(db: Session = Depends(get_db)) -> MenuOut:
    return menu_out(db, include_hidden=True)


def _get_item(db: Session, item_id: str) -> MenuItem:
    item = db.get(MenuItem, item_id)
    if item is None:
        raise HTTPException(404, "Unknown dish")
    return item


@admin.put("/items/{item_id}", response_model_exclude_none=True)
def save_item(item_id: str, body: MenuItemIn, db: Session = Depends(get_db)) -> MenuItemOut:
    """Add a dish, or replace the one with this id."""
    if not re.match(ID_PATTERN, item_id):
        raise HTTPException(422, "Dish ids are lower-case letters, digits and dashes")
    if db.get(MenuCategory, body.category_id) is None:
        raise HTTPException(422, "Unknown category")
    group_ids = list(dict.fromkeys(g.id for g in body.option_groups))
    known = set(db.scalars(select(OptionGroup.id).where(OptionGroup.id.in_(group_ids))).all())
    if missing := [g for g in group_ids if g not in known]:
        raise HTTPException(422, f"Unknown option groups: {', '.join(missing)}")

    item = db.get(MenuItem, item_id)
    if item is None:
        item = MenuItem(
            id=item_id, sort_order=(db.scalar(select(func.max(MenuItem.sort_order))) or 0) + 1
        )
        db.add(item)
    item.category_id = body.category_id
    item.name = body.name.strip()
    item.name_th = (body.name_th or "").strip() or None
    item.number = body.number
    item.description = body.description.strip()
    item.price = body.price
    item.image = store_photo(db, body.image)
    item.recommended = bool(body.recommended)
    item.dietary = list(dict.fromkeys(body.dietary))
    item.allergens = list(dict.fromkeys(body.allergens))
    item.hidden = bool(body.hidden)
    if body.sold_out is not None:
        item.sold_out = body.sold_out
    set_option_groups(db, item, group_ids)
    db.commit()
    db.refresh(item)
    return item_out(item)


@admin.put("/items/{item_id}/hidden")
def set_hidden(item_id: str, body: FlagIn, db: Session = Depends(get_db)) -> dict[str, bool]:
    _get_item(db, item_id).hidden = body.value
    db.commit()
    return {"ok": True}


@staff.put("/items/{item_id}/sold-out")
def set_sold_out(item_id: str, body: FlagIn, db: Session = Depends(get_db)) -> dict[str, bool]:
    _get_item(db, item_id).sold_out = body.value
    db.commit()
    return {"ok": True}


@admin.delete("/items/{item_id}")
def delete_item(item_id: str, db: Session = Depends(get_db)) -> dict[str, bool]:
    """Only dishes that were never ordered; others are hidden instead (orders keep history)."""
    item = _get_item(db, item_id)
    if db.scalar(select(exists().where(OrderItem.menu_item_id == item_id))):
        raise HTTPException(
            409, "This dish is in past orders, so it can't be deleted. Hide it instead."
        )
    db.delete(item)
    db.commit()
    return {"ok": True}


@admin.post("/categories")
def add_category(body: CategoryIn, db: Session = Depends(get_db)) -> CreatedId:
    category_id = f"{slug(body.name) or 'category'}-{secrets.token_hex(2)}"
    last = db.scalar(select(func.max(MenuCategory.sort_order))) or 0
    db.add(MenuCategory(id=category_id, name=body.name.strip(), sort_order=last + 1))
    db.commit()
    return CreatedId(id=category_id)


def _get_category(db: Session, category_id: str) -> MenuCategory:
    category = db.get(MenuCategory, category_id)
    if category is None:
        raise HTTPException(404, "Unknown category")
    return category


@admin.patch("/categories/{category_id}")
def rename_category(
    category_id: str, body: CategoryIn, db: Session = Depends(get_db)
) -> dict[str, bool]:
    _get_category(db, category_id).name = body.name.strip()
    db.commit()
    return {"ok": True}


@admin.post("/categories/{category_id}/move")
def move_category(category_id: str, body: MoveIn, db: Session = Depends(get_db)) -> dict[str, bool]:
    ordered = list(db.scalars(select(MenuCategory).order_by(MenuCategory.sort_order)).all())
    i = next((n for n, c in enumerate(ordered) if c.id == category_id), None)
    if i is None:
        raise HTTPException(404, "Unknown category")
    j = i + body.delta
    if 0 <= j < len(ordered):
        ordered[i], ordered[j] = ordered[j], ordered[i]
        for n, c in enumerate(ordered):
            c.sort_order = n
        db.commit()
    return {"ok": True}


@admin.delete("/categories/{category_id}")
def delete_category(category_id: str, db: Session = Depends(get_db)) -> dict[str, bool]:
    """Only empty categories."""
    category = _get_category(db, category_id)
    if db.scalar(select(exists().where(MenuItem.category_id == category_id))):
        raise HTTPException(409, "Move or delete the dishes in this category first")
    db.delete(category)
    db.commit()
    return {"ok": True}


@admin.post("/reset")
def reset(db: Session = Depends(get_db)) -> dict[str, bool]:
    """Put the sample menu back; sold-out marks are cleared."""
    reset_menu(db)
    db.commit()
    return {"ok": True}
