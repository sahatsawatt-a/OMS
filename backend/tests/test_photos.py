import base64

from tests.test_menu_admin import NEW_DISH

PHOTO = b"\xff\xd8\xff\xe0 pretend jpeg " * 1000  # ~20 KB
PHOTO_URL = "data:image/jpeg;base64," + base64.b64encode(PHOTO).decode()


def save(staff, image, item_id="photo-dish"):
    return staff.put(f"/api/menu/items/{item_id}", json={**NEW_DISH, "image": image})


def test_uploaded_photo_is_served_by_url(staff, client):
    res = save(staff, PHOTO_URL)
    assert res.status_code == 200
    url = res.json()["image"]
    assert url.startswith("/api/menu/photos/") and len(url) < 100

    # The menu carries only the link, not the photo
    menu = client.get("/api/menu")
    assert len(menu.content) < 60_000
    assert next(i for i in menu.json()["items"] if i["id"] == "photo-dish")["image"] == url

    photo = client.get(url)
    assert photo.status_code == 200
    assert photo.content == PHOTO
    assert photo.headers["content-type"] == "image/jpeg"
    assert "immutable" in photo.headers["cache-control"]


def test_same_photo_is_kept_once(staff):
    first = save(staff, PHOTO_URL, "photo-a").json()["image"]
    second = save(staff, PHOTO_URL, "photo-b").json()["image"]
    assert first == second


def test_links_pass_through(staff):
    assert save(staff, "/menu/yt/1.jpg").json()["image"] == "/menu/yt/1.jpg"
    assert "image" not in save(staff, None).json()


def test_bad_photos_are_refused(staff, client):
    gif = "data:image/gif;base64," + base64.b64encode(b"GIF89a").decode()
    assert save(staff, gif).status_code == 422
    assert save(staff, "data:image/jpeg;base64,not base64!").status_code == 422
    too_big = "data:image/jpeg;base64," + base64.b64encode(b"x" * 2_000_001).decode()
    assert save(staff, too_big).status_code == 422
    assert client.get("/api/menu/photos/nope").status_code == 404
