from pathlib import Path

import pytest

from app.menu_data import DISHES
from app.open_photos import OPEN_PHOTOS

PUBLIC = Path(__file__).resolve().parents[2] / "frontend" / "public"

# Pad Thai has a photo from the printed menu; Tod Mun has none
WITH_OWN, WITHOUT_OWN = "pad-thai", "tod-mun"


def guest_photos(client):
    return {i["id"]: i for i in client.get("/api/menu").json()["items"]}


def set_sources(staff, restaurant, open_source):
    res = staff.put(
        "/api/menu/photo-sources", json={"restaurant": restaurant, "openSource": open_source}
    )
    assert res.status_code == 200


def test_every_dish_has_an_open_source_photo():
    assert {d.id for d in DISHES} <= OPEN_PHOTOS.keys()
    for dish_id, credit in OPEN_PHOTOS.items():
        assert (PUBLIC / "menu" / "open" / f"{dish_id}.jpg").is_file(), dish_id
        assert credit.author and credit.license and credit.source.startswith("https://")


def test_restaurant_photos_by_default(client):
    menu = client.get("/api/menu").json()
    assert menu["photoSources"] == {"restaurant": True, "openSource": False}
    items = {i["id"]: i for i in menu["items"]}
    assert items[WITH_OWN]["image"] == "/menu/yt/32.jpg"
    assert "image" not in items[WITHOUT_OWN]
    assert "imageCredit" not in items[WITH_OWN]


@pytest.mark.parametrize(
    ("restaurant", "open_source", "with_own", "without_own"),
    [
        (True, False, "/menu/yt/32.jpg", None),
        (False, True, f"/menu/open/{WITH_OWN}.jpg", f"/menu/open/{WITHOUT_OWN}.jpg"),
        # Both: open-source photos only fill the gaps
        (True, True, "/menu/yt/32.jpg", f"/menu/open/{WITHOUT_OWN}.jpg"),
        (False, False, None, None),
    ],
)
def test_photo_sources(staff, client, restaurant, open_source, with_own, without_own):
    set_sources(staff, restaurant, open_source)
    items = guest_photos(client)
    for dish_id, expected in ((WITH_OWN, with_own), (WITHOUT_OWN, without_own)):
        assert items[dish_id].get("image") == expected
        # Open-source photos carry their credit; the restaurant's own need none
        is_open = expected is not None and expected.startswith("/menu/open/")
        assert ("imageCredit" in items[dish_id]) == is_open
    assert client.get("/api/menu").json()["photoSources"] == {
        "restaurant": restaurant,
        "openSource": open_source,
    }


def test_open_source_only_shows_every_dish(staff, client):
    set_sources(staff, False, True)
    assert all(i.get("image", "").startswith("/menu/open/") for i in guest_photos(client).values())


def test_staff_menu_keeps_the_dishes_own_photo(staff):
    """The admin page edits the dish's own photo, so it must not get the open-source one back."""
    set_sources(staff, False, True)
    items = {i["id"]: i for i in staff.get("/api/menu/all").json()["items"]}
    assert items[WITH_OWN]["image"] == "/menu/yt/32.jpg"
    assert "image" not in items[WITHOUT_OWN]
    assert items[WITHOUT_OWN]["openPhoto"]["url"] == f"/menu/open/{WITHOUT_OWN}.jpg"
    assert items[WITHOUT_OWN]["openPhoto"]["license"]


def test_uploaded_photo_counts_as_the_restaurants(staff, client):
    set_sources(staff, True, True)
    dish = staff.get("/api/menu/all").json()["items"]
    tod_mun = next(i for i in dish if i["id"] == WITHOUT_OWN)
    res = staff.put(f"/api/menu/items/{WITHOUT_OWN}", json={**tod_mun, "image": "/menu/yt/1.jpg"})
    assert res.status_code == 200
    assert guest_photos(client)[WITHOUT_OWN]["image"] == "/menu/yt/1.jpg"


def test_only_staff_change_photo_sources(client):
    res = client.put("/api/menu/photo-sources", json={"restaurant": False, "openSource": True})
    assert res.status_code == 401
