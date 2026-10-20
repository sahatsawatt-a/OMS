"""Menu API.

GET /api/menu is public (the customer menu). Everything under /api/admin/menu changes the
menu and needs the X-Admin-Key header until staff login exists (REQ-28).

JSON uses the same camelCase field names as the frontend's MenuItem type
(frontend/src/demo/types.ts). Dishes and categories are saved by id with PUT (create or
replace), and the ids come from the admin page, matching how the demo store works.
"""

import hmac
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.models import MenuCategory, MenuItem

# ---------- Schemas ----------


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class OptionChoice(CamelModel):
    id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=100)
    price: int = Field(ge=0, description="Extra price in cents")


class OptionGroup(CamelModel):
    id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=100)
    type: Literal["single", "multi"]
    choices: list[OptionChoice] = Field(min_length=1)


Dietary = Literal["vegetarian", "vegan", "vegetarian-option", "halal"]
Allergen = Literal["dairy", "peanuts", "tree-nuts", "shellfish", "egg"]


class CategoryOut(CamelModel):
    id: str
    name: str


class MenuItemIn(CamelModel):
    """A dish as sent by the admin page (create or edit)."""

    category_id: str
    name: str = Field(min_length=1, max_length=150)
    description: str = Field(default="", max_length=2000)
    price: int = Field(ge=0, le=1_000_000, description="Price in cents, GST included")
    # URL or uploaded photo as a data: URL; the admin page shrinks photos to ~250 KB
    image: str | None = Field(default=None, max_length=2_000_000)
    recommended: bool = False
    option_groups: list[OptionGroup] = Field(default_factory=list)
    dietary: list[Dietary] = Field(default_factory=list)
    allergens: list[Allergen] = Field(default_factory=list)
    hidden: bool = False


class MenuItemOut(MenuItemIn):
    id: str
    sold_out: bool


class MenuOut(CamelModel):
    categories: list[CategoryOut]
    items: list[MenuItemOut]


class ItemFlagsIn(CamelModel):
    """Quick toggles from the admin page; send only the ones that change."""

    hidden: bool | None = None
    sold_out: bool | None = None


class CategoryIn(CamelModel):
    name: str = Field(min_length=1, max_length=100)


class CategoryOrderIn(CamelModel):
    ids: list[str]


# ---------- Helpers ----------


def require_admin(x_admin_key: str | None = Header(default=None)) -> None:
    expected = get_settings().admin_api_key
    if not expected:
        raise HTTPException(status_code=503, detail="ADMIN_API_KEY is not configured")
    if not x_admin_key or not hmac.compare_digest(x_admin_key, expected):
        raise HTTPException(status_code=401, detail="Invalid admin key")


def item_out(item: MenuItem) -> MenuItemOut:
    return MenuItemOut(
        id=item.id,
        category_id=item.category_id,
        name=item.name,
        description=item.description,
        price=item.price_cents,
        image=item.image,
        recommended=item.recommended,
        option_groups=item.option_groups,
        dietary=item.dietary,
        allergens=item.allergens,
        hidden=item.hidden,
        sold_out=item.sold_out,
    )


def load_menu(db: Session, include_hidden: bool) -> MenuOut:
    categories = db.scalars(select(MenuCategory).order_by(MenuCategory.sort_order)).all()
    query = select(MenuItem).order_by(MenuItem.sort_order)
    if not include_hidden:
        query = query.where(MenuItem.hidden.is_(False))
    return MenuOut(
        categories=[CategoryOut(id=c.id, name=c.name) for c in categories],
        items=[item_out(i) for i in db.scalars(query)],
    )


def get_item_or_404(db: Session, item_id: str) -> MenuItem:
    item = db.get(MenuItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Dish not found")
    return item


def get_category_or_404(db: Session, category_id: str) -> MenuCategory:
    category = db.get(MenuCategory, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


def next_sort_order(db: Session, column) -> int:
    return (db.scalar(select(func.max(column))) or 0) + 1


# ---------- Public ----------

router = APIRouter(tags=["menu"])


@router.get("/menu")
def get_menu(db: Session = Depends(get_db)) -> MenuOut:
    """The customer menu: every category, and the dishes that aren't hidden."""
    return load_menu(db, include_hidden=False)


# ---------- Admin ----------

admin_router = APIRouter(
    prefix="/admin/menu", tags=["menu admin"], dependencies=[Depends(require_admin)]
)


@admin_router.get("")
def get_admin_menu(db: Session = Depends(get_db)) -> MenuOut:
    """The full menu for the admin page, hidden dishes included."""
    return load_menu(db, include_hidden=True)


@admin_router.put("/items/{item_id}")
def save_item(item_id: str, data: MenuItemIn, db: Session = Depends(get_db)) -> MenuItemOut:
    """Create the dish with this id, or replace it if it exists (like saveMenuItem)."""
    get_category_or_404(db, data.category_id)
    item = db.get(MenuItem, item_id)
    if item is None:
        item = MenuItem(id=item_id, sort_order=next_sort_order(db, MenuItem.sort_order))
        db.add(item)
    item.category_id = data.category_id
    item.name = data.name
    item.description = data.description
    item.price_cents = data.price
    item.image = data.image
    item.recommended = data.recommended
    item.option_groups = [g.model_dump() for g in data.option_groups]
    item.dietary = list(data.dietary)
    item.allergens = list(data.allergens)
    item.hidden = data.hidden
    db.commit()
    return item_out(item)


@admin_router.patch("/items/{item_id}")
def update_item_flags(
    item_id: str, data: ItemFlagsIn, db: Session = Depends(get_db)
) -> MenuItemOut:
    """Hide/show a dish or mark it sold out."""
    item = get_item_or_404(db, item_id)
    if data.hidden is not None:
        item.hidden = data.hidden
    if data.sold_out is not None:
        item.sold_out = data.sold_out
    db.commit()
    return item_out(item)


@admin_router.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: str, db: Session = Depends(get_db)) -> Response:
    # Once orders are stored, refuse here if the dish was ever ordered (hide it instead).
    db.delete(get_item_or_404(db, item_id))
    db.commit()
    return Response(status_code=204)


@admin_router.put("/categories/order")
def reorder_categories(data: CategoryOrderIn, db: Session = Depends(get_db)) -> MenuOut:
    """Set the category order; send every category id in the new order."""
    categories = {c.id: c for c in db.scalars(select(MenuCategory))}
    if sorted(data.ids) != sorted(categories):
        raise HTTPException(status_code=422, detail="Send every category id exactly once")
    for position, category_id in enumerate(data.ids):
        categories[category_id].sort_order = position
    db.commit()
    return load_menu(db, include_hidden=True)


@admin_router.put("/categories/{category_id}")
def save_category(category_id: str, data: CategoryIn, db: Session = Depends(get_db)) -> CategoryOut:
    """Create the category with this id (added at the end), or rename it if it exists."""
    category = db.get(MenuCategory, category_id)
    if category is None:
        category = MenuCategory(
            id=category_id, sort_order=next_sort_order(db, MenuCategory.sort_order)
        )
        db.add(category)
    category.name = data.name
    db.commit()
    return CategoryOut(id=category.id, name=category.name)


@admin_router.delete("/categories/{category_id}", status_code=204)
def delete_category(category_id: str, db: Session = Depends(get_db)) -> Response:
    category = get_category_or_404(db, category_id)
    if db.scalar(select(MenuItem.id).where(MenuItem.category_id == category_id).limit(1)):
        raise HTTPException(status_code=409, detail="Only empty categories can be deleted")
    db.delete(category)
    db.commit()
    return Response(status_code=204)
