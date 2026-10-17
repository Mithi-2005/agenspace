"""Add Gmail extraction state and timezone aware suggestion details.

Revision ID: c94152ab781f
Revises: c8f4a2b1d9e6
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "c94152ab781f"
down_revision: str | None = "c8f4a2b1d9e6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()

    def add_if_missing(table: str, column: sa.Column) -> None:
        if column.name not in {item["name"] for item in inspect(bind).get_columns(table)}:
            op.add_column(table, column)

    add_if_missing("users", sa.Column("timezone", sa.String(length=100), nullable=True))
    # These columns may already exist on databases that ran the reverted trial.
    # Keep them and their values intact.
    add_if_missing("gmail_messages", sa.Column("content_hash", sa.String(length=64), nullable=True))
    add_if_missing(
        "gmail_messages",
        sa.Column(
            "extraction_status", sa.String(length=30), nullable=False, server_default="pending"
        ),
    )
    add_if_missing("gmail_messages", sa.Column("extraction_error", sa.Text(), nullable=True))
    add_if_missing(
        "gmail_messages", sa.Column("extracted_at", sa.DateTime(timezone=True), nullable=True)
    )
    add_if_missing("suggestions", sa.Column("priority", sa.String(length=20), nullable=True))
    add_if_missing("suggestions", sa.Column("timezone", sa.String(length=100), nullable=True))
    add_if_missing("suggestions", sa.Column("location", sa.String(length=500), nullable=True))
    add_if_missing("events", sa.Column("timezone", sa.String(length=100), nullable=True))

    events = {item["name"]: item for item in inspect(bind).get_columns("events")}
    if events["ends_at"]["nullable"] is False:
        op.alter_column(
            "events", "ends_at", existing_type=sa.DateTime(timezone=True), nullable=True
        )

    # The reverted schema used DOUBLE PRECISION, while this application stores
    # confidence as text. Convert values in place so existing suggestions survive.
    suggestions = {item["name"]: item for item in inspect(bind).get_columns("suggestions")}
    confidence_type = suggestions["confidence"]["type"]
    if isinstance(confidence_type, (sa.Float, sa.Numeric)):
        op.alter_column(
            "suggestions",
            "confidence",
            existing_type=confidence_type,
            type_=sa.String(length=50),
            postgresql_using="confidence::text",
        )


def downgrade() -> None:
    # Preserve columns that may have been added before code was reverted.
    # In particular, never drop legacy Gmail/suggestion fields containing data.
    bind = op.get_bind()
    events = {item["name"]: item for item in inspect(bind).get_columns("events")}
    if events["ends_at"]["nullable"]:
        op.alter_column(
            "events", "ends_at", existing_type=sa.DateTime(timezone=True), nullable=False
        )
