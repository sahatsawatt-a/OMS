"""floor plan: where each table sits, and landmark labels such as the counter or the door

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-25 10:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Cells of the plan's grid; empty until the admin places the table (the plan lays it out)
    op.add_column("dining_tables", sa.Column("x", sa.Integer(), nullable=True))
    op.add_column("dining_tables", sa.Column("y", sa.Integer(), nullable=True))
    op.add_column("dining_tables", sa.Column("w", sa.Integer(), nullable=False, server_default="2"))
    op.add_column("dining_tables", sa.Column("h", sa.Integer(), nullable=False, server_default="2"))
    op.add_column(
        "dining_tables",
        sa.Column("shape", sa.String(length=10), nullable=False, server_default="square"),
    )
    op.create_table(
        "floor_fixtures",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("zone", sa.String(length=60), nullable=False),
        sa.Column("label", sa.String(length=40), nullable=False),
        sa.Column("x", sa.Integer(), nullable=False),
        sa.Column("y", sa.Integer(), nullable=False),
        sa.Column("w", sa.Integer(), nullable=False),
        sa.Column("h", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("floor_fixtures")
    for column in ("shape", "h", "w", "y", "x"):
        op.drop_column("dining_tables", column)
