"""menu photos: move uploaded photos out of menu_items

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-20 11:00:00

"""

import base64
import binascii
import hashlib
import re
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PHOTO_URL = "/api/menu/photos/"
DATA_URL = re.compile(r"^data:([a-z]+/[a-z0-9.+-]+);base64,(.*)$", re.DOTALL)

photos = sa.table(
    "menu_photos", sa.column("id"), sa.column("content_type"), sa.column("data", sa.LargeBinary)
)
items = sa.table("menu_items", sa.column("id"), sa.column("image"))


def upgrade() -> None:
    op.create_table(
        "menu_photos",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("content_type", sa.String(length=32), nullable=False),
        sa.Column(
            "data", sa.LargeBinary().with_variant(mysql.MEDIUMBLOB(), "mysql"), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Photos uploaded before this stayed inside the dish as data URLs
    conn = op.get_bind()
    stored: set[str] = set()
    rows = conn.execute(sa.select(items.c.id, items.c.image).where(items.c.image.like("data:%")))
    for item_id, image in rows.all():
        match = DATA_URL.match(image)
        if match is None:
            continue
        try:
            data = base64.b64decode(match.group(2), validate=True)
        except (binascii.Error, ValueError):
            continue
        photo_id = hashlib.sha256(data).hexdigest()
        if photo_id not in stored:
            content_type = match.group(1)
            conn.execute(photos.insert().values(id=photo_id, content_type=content_type, data=data))
            stored.add(photo_id)
        conn.execute(items.update().where(items.c.id == item_id).values(image=PHOTO_URL + photo_id))


def downgrade() -> None:
    conn = op.get_bind()
    for photo_id, content_type, data in conn.execute(sa.select(photos)).all():
        data_url = f"data:{content_type};base64,{base64.b64encode(data).decode()}"
        conn.execute(
            items.update().where(items.c.image == PHOTO_URL + photo_id).values(image=data_url)
        )
    op.drop_table("menu_photos")
