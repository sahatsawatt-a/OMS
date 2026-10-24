"""API shapes: camelCase JSON, times in epoch ms, matching frontend/src/demo/types.ts."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

DietaryTag = Literal["vegetarian", "vegan", "vegetarian-option", "halal", "gluten-free", "spicy"]
Allergen = Literal["dairy", "peanuts", "tree-nuts", "shellfish", "egg"]
# No kitchen control for now: paid food is brought to the table and marked served
ItemStatus = Literal["submitted", "served", "cancelled"]
PaymentStatus = Literal["pending", "awaiting_counter", "paid", "cancelled"]
PaymentMethod = Literal["stripe", "cash", "card_terminal"]
# Card types the reports split by (REQ-39)
CardBrand = Literal["visa", "mastercard", "amex", "eftpos", "other"]

# A resized JPEG from the admin page is ~100-300 KB as a data URL (stored apart, see
# app/services/photos.py); refuse anything silly
MAX_IMAGE_CHARS = 3_000_000


class Model(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


# ---- Menu ----


class OptionChoiceOut(Model):
    id: str
    name: str
    price: int


class OptionGroupOut(Model):
    id: str
    name: str
    type: Literal["single", "multi"]
    choices: list[OptionChoiceOut]


class CategoryOut(Model):
    id: str
    name: str
    name_th: str | None = None


class MenuItemOut(Model):
    id: str
    category_id: str
    number: int | None = None
    name: str
    name_th: str | None = None
    description: str
    price: int
    image: str | None = None
    recommended: bool | None = None
    option_groups: list[OptionGroupOut] = []
    dietary: list[str] = []
    allergens: list[str] = []
    hidden: bool | None = None


class MenuOut(Model):
    categories: list[CategoryOut]
    items: list[MenuItemOut]
    option_groups: list[OptionGroupOut]
    sold_out: list[str]


class OptionGroupRef(Model):
    id: str


class MenuItemIn(Model):
    category_id: str = Field(min_length=1, max_length=64)
    number: int | None = Field(default=None, ge=1, le=9999)
    name: str = Field(min_length=1, max_length=160)
    name_th: str | None = Field(default=None, max_length=160)
    description: str = Field(default="", max_length=1000)
    price: int = Field(gt=0, le=1_000_000)
    image: str | None = Field(default=None, max_length=MAX_IMAGE_CHARS)
    recommended: bool | None = False
    # The admin page sends whole option groups; only their ids are used
    option_groups: list[OptionGroupRef] = []
    dietary: list[DietaryTag] = []
    allergens: list[Allergen] = []
    hidden: bool | None = False
    sold_out: bool | None = None


class FlagIn(Model):
    value: bool


class CategoryIn(Model):
    name: str = Field(min_length=1, max_length=120)


class MoveIn(Model):
    delta: Literal[-1, 1]


class CreatedId(Model):
    id: str


# ---- Tables and sessions ----


class TableOut(Model):
    id: str
    number: int
    seats: int
    zone: str


class DeviceOut(Model):
    """A phone at the table (REQ-37)."""

    label: str
    joined_at: int
    removed_at: int | None = None


class SessionOut(Model):
    """A table session as staff see it, QR token included."""

    id: int
    token: str
    table_id: str
    table_number: int
    guests: int
    status: Literal["open", "closed"]
    opened_at: int
    closed_at: int | None = None
    waiter_called_at: int | None = None
    devices: list[DeviceOut] = []


class GuestSessionOut(Model):
    """A table session as a guest's phone sees it: no QR token, no other phones' details."""

    table_number: int
    guests: int
    status: Literal["open", "closed"]
    opened_at: int
    closed_at: int | None = None
    waiter_called_at: int | None = None


class JoinOut(Model):
    """A phone that joined a table: its own key and its letter."""

    device_token: str
    label: str


class OpenSessionIn(Model):
    guests: int = Field(ge=1, le=50)


# ---- Orders ----


class SelectedOptionOut(Model):
    group_id: str | None = None
    choice_id: str | None = None
    group_name: str
    choice_name: str
    price: int


class OrderItemOut(Model):
    id: str
    menu_item_id: str
    name: str
    unit_price: int
    quantity: int
    options: list[SelectedOptionOut]
    note: str
    status: ItemStatus


class OrderPaymentOut(Model):
    status: PaymentStatus
    amount: int
    method: PaymentMethod | None = None
    # Taken off at the counter; amount is after it. Left out when there was none
    discount: int | None = None
    card_brand: CardBrand | None = None
    paid_at: int | None = None
    cancelled_at: int | None = None
    intent_id: str | None = None


class OrderOut(Model):
    id: str
    # Given once the order is visible to staff (paid, or waiting at the counter)
    number: int | None = None
    # Staff only; guests never see the QR token
    session_token: str | None = None
    # The phone that placed it (A, B, ...); empty for orders placed before phones had ids
    device: str | None = None
    table_number: int
    round: int
    created_at: int
    items: list[OrderItemOut]
    payment: OrderPaymentOut


class PickedOption(Model):
    group_id: str = Field(max_length=64)
    choice_id: str = Field(max_length=64)


class OrderLineIn(Model):
    menu_item_id: str = Field(max_length=64)
    quantity: int = Field(ge=1, le=50)
    options: list[PickedOption] = Field(default=[], max_length=20)
    note: str = Field(default="", max_length=200)


class PlaceOrderIn(Model):
    lines: list[OrderLineIn] = Field(min_length=1, max_length=50)
    pay: Literal["stripe", "counter"]


class StripeCheckout(Model):
    """How the browser takes the payment: Stripe Elements, or a simulated card (no Stripe keys)."""

    intent_id: str
    client_secret: str | None = None
    simulated: bool = False


class PlaceOrderOut(Model):
    order: OrderOut
    payment: StripeCheckout | None = None


class PaymentCheckOut(Model):
    """Stripe's view of the payment (succeeded, processing, requires_payment_method, ...)."""

    status: str
    order: OrderOut


class CounterPaymentIn(Model):
    method: Literal["cash", "card_terminal"]
    # In cents, off the order's amount
    discount: int = Field(default=0, ge=0)
    # Staff pick it when taking a card at the counter: required for cards, refused for cash
    card_brand: CardBrand | None = None


class ItemStatusIn(Model):
    status: ItemStatus


# ---- Screens ----


class StaffState(Model):
    """Everything the front-of-house, admin and reports screens show."""

    tables: list[TableOut]
    sessions: dict[str, SessionOut]
    orders: list[OrderOut]
    menu: MenuOut


class GuestState(Model):
    """What a guest's phone shows: its table, its own letter, the table's orders, the menu."""

    session: GuestSessionOut
    device: str
    orders: list[OrderOut]
    menu: MenuOut
