import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings
from app.db.session import get_db
from app.main import app
from app.models import Base, MenuCategory, MenuItem

ADMIN = {"X-Admin-Key": "test-key"}

# In-memory SQLite stands in for MySQL, so these tests need no database server
engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def override_get_db():
    with TestSession() as db:
        yield db


@pytest.fixture(autouse=True)
def menu_db(monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "test-key")
    get_settings.cache_clear()
    Base.metadata.create_all(engine)
    with TestSession() as db:
        db.add_all(
            [
                MenuCategory(id="noodles", name="Noodles", sort_order=0),
                MenuCategory(id="drinks", name="Drinks", sort_order=1),
                MenuItem(id="pad-thai", category_id="noodles", name="Pad Thai", price_cents=2300),
                MenuItem(
                    id="secret", category_id="noodles", name="Secret", price_cents=100, hidden=True
                ),
            ]
        )
        db.commit()
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)
    get_settings.cache_clear()


client = TestClient(app)


def test_public_menu_hides_hidden_dishes():
    res = client.get("/api/menu")
    assert res.status_code == 200
    body = res.json()
    assert [c["id"] for c in body["categories"]] == ["noodles", "drinks"]
    assert [i["id"] for i in body["items"]] == ["pad-thai"]
    # Same field names as the frontend's MenuItem type
    assert body["items"][0]["categoryId"] == "noodles"
    assert body["items"][0]["price"] == 2300
    assert body["items"][0]["soldOut"] is False


def test_admin_needs_key():
    assert client.get("/api/admin/menu").status_code == 401
    assert client.get("/api/admin/menu", headers={"X-Admin-Key": "wrong"}).status_code == 401
    assert len(client.get("/api/admin/menu", headers=ADMIN).json()["items"]) == 2


def test_create_and_edit_dish():
    dish = {
        "categoryId": "drinks",
        "name": "Thai iced tea",
        "price": 700,
        "optionGroups": [
            {
                "id": "sweetness",
                "name": "Sweetness",
                "type": "single",
                "choices": [{"id": "less", "name": "Less sweet", "price": 0}],
            }
        ],
        "dietary": ["vegetarian"],
        "allergens": ["dairy"],
    }
    res = client.put("/api/admin/menu/items/thai-tea", json=dish, headers=ADMIN)
    assert res.status_code == 200
    assert res.json()["optionGroups"][0]["choices"][0]["name"] == "Less sweet"

    res = client.put("/api/admin/menu/items/thai-tea", json={**dish, "price": 800}, headers=ADMIN)
    assert res.json()["price"] == 800
    assert any(i["id"] == "thai-tea" for i in client.get("/api/menu").json()["items"])


def test_rejects_bad_dish():
    bad_category = {"categoryId": "nope", "name": "X", "price": 100}
    res = client.put("/api/admin/menu/items/x", json=bad_category, headers=ADMIN)
    assert res.status_code == 404
    bad_allergen = {"categoryId": "drinks", "name": "X", "price": 100, "allergens": ["gluten"]}
    res = client.put("/api/admin/menu/items/x", json=bad_allergen, headers=ADMIN)
    assert res.status_code == 422


def test_sold_out_and_hide():
    res = client.patch("/api/admin/menu/items/pad-thai", json={"soldOut": True}, headers=ADMIN)
    assert res.json()["soldOut"] is True
    assert client.get("/api/menu").json()["items"][0]["soldOut"] is True

    client.patch("/api/admin/menu/items/pad-thai", json={"hidden": True}, headers=ADMIN)
    assert client.get("/api/menu").json()["items"] == []


def test_delete_dish():
    assert client.delete("/api/admin/menu/items/pad-thai", headers=ADMIN).status_code == 204
    assert client.delete("/api/admin/menu/items/pad-thai", headers=ADMIN).status_code == 404


def test_categories():
    res = client.put(
        "/api/admin/menu/categories/desserts", json={"name": "Desserts"}, headers=ADMIN
    )
    assert res.status_code == 200
    # Saving again with the same id renames it
    res = client.put("/api/admin/menu/categories/desserts", json={"name": "Sweets"}, headers=ADMIN)
    assert res.json() == {"id": "desserts", "name": "Sweets"}

    order = {"ids": ["desserts", "drinks", "noodles"]}
    res = client.put("/api/admin/menu/categories/order", json=order, headers=ADMIN)
    assert [c["id"] for c in res.json()["categories"]] == ["desserts", "drinks", "noodles"]
    bad_order = {"ids": ["drinks", "noodles"]}
    res = client.put("/api/admin/menu/categories/order", json=bad_order, headers=ADMIN)
    assert res.status_code == 422

    # A category with dishes can't be deleted; an empty one can
    assert client.delete("/api/admin/menu/categories/noodles", headers=ADMIN).status_code == 409
    assert client.delete("/api/admin/menu/categories/desserts", headers=ADMIN).status_code == 204


def test_uploaded_photo_fits():
    photo = "data:image/jpeg;base64," + "A" * 300_000
    dish = {"categoryId": "drinks", "name": "Coconut", "price": 900, "image": photo}
    res = client.put("/api/admin/menu/items/coconut", json=dish, headers=ADMIN)
    assert res.status_code == 200
    assert len(client.get("/api/menu").json()["items"][-1]["image"]) == len(photo)
