"""table devices: each phone at a table, and the phone behind each order

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-20 12:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "table_devices",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=3), nullable=False),
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column("joined_at", sa.DateTime(), nullable=False),
        sa.Column("removed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["session_id"], ["table_sessions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", "label", name="uq_table_devices_label"),
        sa.UniqueConstraint("token"),
    )
    op.create_index("ix_table_devices_session_id", "table_devices", ["session_id"])
    op.add_column("orders", sa.Column("device_id", sa.Integer(), nullable=True))
    op.create_index("ix_orders_device_id", "orders", ["device_id"])
    op.create_foreign_key("fk_orders_device_id", "orders", "table_devices", ["device_id"], ["id"])


def downgrade() -> None:
    op.drop_constraint("fk_orders_device_id", "orders", type_="foreignkey")
    op.drop_index("ix_orders_device_id", table_name="orders")
    op.drop_column("orders", "device_id")
    op.drop_index("ix_table_devices_session_id", table_name="table_devices")
    op.drop_table("table_devices")
