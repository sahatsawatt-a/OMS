"""Dish photos uploaded in the admin page (REQ-35).

The admin page sends a resized photo as a data: URL. Kept inside the dish, it would travel with
the menu on every refresh of every screen, so it is stored in menu_photos instead and the dish
keeps a short URL that browsers cache.
"""

import base64
import binascii
import hashlib
import re

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import MenuPhoto

PHOTO_URL = "/api/menu/photos/"
PHOTO_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_PHOTO_BYTES = 2_000_000

DATA_URL = re.compile(r"^data:([a-z]+/[a-z0-9.+-]+);base64,(.*)$", re.DOTALL)


def store_photo(db: Session, image: str | None) -> str | None:
    """Store an uploaded data: URL and return its photo URL; links (e.g. /menu/...) pass through."""
    if not image:
        return None
    if not image.startswith("data:"):
        return image
    match = DATA_URL.match(image)
    if match is None or match.group(1) not in PHOTO_TYPES:
        raise HTTPException(422, "Photos must be JPEG, PNG or WebP")
    try:
        data = base64.b64decode(match.group(2), validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(422, "The photo could not be read") from None
    if not data:
        raise HTTPException(422, "The photo is empty")
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(422, "The photo is too large (2 MB at most)")

    # Named by its content, so the same photo is kept once and a URL always shows the same picture
    photo_id = hashlib.sha256(data).hexdigest()
    if db.get(MenuPhoto, photo_id) is None:
        db.add(MenuPhoto(id=photo_id, content_type=match.group(1), data=data))
    return PHOTO_URL + photo_id
