"""Which dish photos the guest menu shows, set on the admin page.

- Restaurant only: the restaurant's own photos (cut from the printed menu, or uploaded); dishes
  without one show none.
- Open-source only: the Wikimedia Commons photo every printed-menu dish has (app/open_photos.py).
- Both: the restaurant's photo where there is one, an open-source photo for the rest.
- Neither: a text-only menu.
"""

from sqlalchemy.orm import Session

from app.models import AppSetting, MenuItem
from app.open_photos import OPEN_PHOTOS, open_photo_url
from app.schemas import PhotoCredit, PhotoSources

KEY = "photo_sources"
DEFAULT = PhotoSources(restaurant=True, open_source=False)


def get_photo_sources(db: Session) -> PhotoSources:
    row = db.get(AppSetting, KEY)
    return DEFAULT if row is None else PhotoSources.model_validate(row.value)


def set_photo_sources(db: Session, sources: PhotoSources) -> None:
    value = sources.model_dump()
    row = db.get(AppSetting, KEY)
    if row is None:
        db.add(AppSetting(key=KEY, value=value))
    else:
        row.value = value


def shown_photo(m: MenuItem, sources: PhotoSources) -> tuple[str | None, PhotoCredit | None]:
    """The photo a guest sees for a dish, and its credit when it is an open-source one."""
    if sources.restaurant and m.image:
        return m.image, None
    if sources.open_source and m.id in OPEN_PHOTOS:
        return open_photo_url(m.id), OPEN_PHOTOS[m.id]
    return None, None
