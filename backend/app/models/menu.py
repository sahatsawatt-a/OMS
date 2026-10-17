from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.mysql import MEDIUMTEXT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

# Photos uploaded in the admin page arrive as resized JPEG data URLs
PhotoText = Text().with_variant(MEDIUMTEXT(), "mysql")


class MenuCategory(Base):
    __tablename__ = "menu_categories"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    name_th: Mapped[str | None] = mapped_column(String(120), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class OptionGroup(Base):
    """Shared option groups (protein, spice level, ...) that dishes can offer."""

    __tablename__ = "option_groups"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    # single = pick exactly one, multi = pick any
    type: Mapped[str] = mapped_column(String(10))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    choices: Mapped[list["OptionChoice"]] = relationship(
        order_by="OptionChoice.sort_order", cascade="all, delete-orphan", lazy="selectin"
    )


class OptionChoice(Base):
    __tablename__ = "option_choices"

    group_id: Mapped[str] = mapped_column(ForeignKey("option_groups.id"), primary_key=True)
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    # Extra price in cents
    price: Mapped[int] = mapped_column(Integer, default=0)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class MenuItemOptionGroup(Base):
    __tablename__ = "menu_item_option_groups"

    item_id: Mapped[str] = mapped_column(ForeignKey("menu_items.id"), primary_key=True)
    group_id: Mapped[str] = mapped_column(ForeignKey("option_groups.id"), primary_key=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    group: Mapped[OptionGroup] = relationship(lazy="selectin")


class MenuItem(Base):
    __tablename__ = "menu_items"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    category_id: Mapped[str] = mapped_column(ForeignKey("menu_categories.id"), index=True)
    # The dish number on the printed menu, which guests and staff often order by
    number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    name: Mapped[str] = mapped_column(String(160))
    name_th: Mapped[str | None] = mapped_column(String(160), nullable=True)
    description: Mapped[str] = mapped_column(String(1000), default="")
    # Price in cents, including GST
    price: Mapped[int] = mapped_column(Integer)
    image: Mapped[str | None] = mapped_column(PhotoText, nullable=True)
    recommended: Mapped[bool] = mapped_column(Boolean, default=False)
    dietary: Mapped[list[str]] = mapped_column(JSON, default=list)
    allergens: Mapped[list[str]] = mapped_column(JSON, default=list)
    # Hidden dishes stay in past orders but are not shown on the menu
    hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    sold_out: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    option_links: Mapped[list[MenuItemOptionGroup]] = relationship(
        order_by=MenuItemOptionGroup.sort_order, cascade="all, delete-orphan", lazy="selectin"
    )

    @property
    def option_groups(self) -> list[OptionGroup]:
        return [link.group for link in self.option_links]
