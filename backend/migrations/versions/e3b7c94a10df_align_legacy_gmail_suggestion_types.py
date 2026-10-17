"""Align leftover Gmail suggestion types with the current ORM models.

Revision ID: e3b7c94a10df
Revises: d2f6a1c8b503
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "e3b7c94a10df"
down_revision: str | None = "d2f6a1c8b503"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = {column["name"]: column for column in inspect(bind).get_columns("suggestions")}
    priority = columns.get("priority")
    if priority and isinstance(priority["type"], sa.Enum):
        op.alter_column(
            "suggestions",
            "priority",
            existing_type=priority["type"],
            type_=sa.String(length=20),
            postgresql_using="priority::text",
        )

    # The old experimental database installed a numeric default. Current
    # application code supplies its own text default, so remove the stale one.
    if columns.get("confidence", {}).get("default") is not None:
        op.alter_column("suggestions", "confidence", server_default=None)


def downgrade() -> None:
    # Keep converted values readable as text when downgrading.
    pass
