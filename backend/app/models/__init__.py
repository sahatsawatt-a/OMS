# Import every model module here so Alembic autogenerate can see it.
from app.db.base import Base
from app.models.menu import MenuCategory, MenuItem, MenuItemOptionGroup, OptionChoice, OptionGroup
from app.models.orders import Order, OrderItem
from app.models.tables import DiningTable, TableSession

__all__ = [
    "Base",
    "DiningTable",
    "MenuCategory",
    "MenuItem",
    "MenuItemOptionGroup",
    "OptionChoice",
    "OptionGroup",
    "Order",
    "OrderItem",
    "TableSession",
]
