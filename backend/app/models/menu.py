from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.mysql import MEDIUMTEXT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class MenuCategory(Base):
    __tablename__ = "menu_categories"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    items: Mapped[list["MenuItem"]] = relationship(back_populates="category")


class MenuItem(Base):
    __tablename__ = "menu_items"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    category_id: Mapped[str] = mapped_column(ForeignKey("menu_categories.id"))
    name: Mapped[str] = mapped_column(String(150))
    description: Mapped[str] = mapped_column(Text, default="")
    price_cents: Mapped[int] = mapped_column(Integer)  # AUD, GST included
    # A URL like /menu/pad-thai.jpg, or an uploaded photo as a data: URL (often 100-250 KB),
    # so MySQL needs MEDIUMTEXT (up to 16 MB) rather than TEXT (64 KB)
    image: Mapped[str | None] = mapped_column(
        Text().with_variant(MEDIUMTEXT(), "mysql"), nullable=True
    )
    recommended: Mapped[bool] = mapped_column(Boolean, default=False)
    # [{"id","name","type":"single"|"multi","choices":[{"id","name","price"}]}]
    option_groups: Mapped[list] = mapped_column(JSON, default=list)
    dietary: Mapped[list] = mapped_column(JSON, default=list)
    allergens: Mapped[list] = mapped_column(JSON, default=list)
    hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    sold_out: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    category: Mapped[MenuCategory] = relationship(back_populates="items")
