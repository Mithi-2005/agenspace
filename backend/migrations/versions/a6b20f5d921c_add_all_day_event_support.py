"""Represent all-day Gmail and user events without shifting their display date.

Revision ID: a6b20f5d921c
Revises: f1a4c6d8e203
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a6b20f5d921c"
down_revision: str | None = "f1a4c6d8e203"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    for table in ("events", "suggestions"):
        op.add_column(
            table,
            sa.Column("all_day", sa.Boolean(), nullable=False, server_default=sa.false()),
        )
        op.alter_column(table, "all_day", server_default=None)


def downgrade() -> None:
    op.drop_column("suggestions", "all_day")
    op.drop_column("events", "all_day")
