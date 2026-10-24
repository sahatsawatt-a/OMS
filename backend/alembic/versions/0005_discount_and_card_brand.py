"""counter payments: a discount off the bill, and the card brand for the record

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-25 12:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("discount", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("orders", sa.Column("card_brand", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "card_brand")
    op.drop_column("orders", "discount")
