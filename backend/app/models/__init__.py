# Import every model module here so Alembic autogenerate can see it.
from app.db.base import Base
from app.models.menu import MenuCategory, MenuItem

__all__ = ["Base", "MenuCategory", "MenuItem"]