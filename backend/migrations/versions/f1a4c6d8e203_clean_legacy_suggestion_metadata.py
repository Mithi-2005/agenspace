"""Remove unused metadata left by the reverted Gmail experiment.

Revision ID: f1a4c6d8e203
Revises: e3b7c94a10df
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f1a4c6d8e203"
down_revision: str | None = "e3b7c94a10df"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    suggestion_columns = {column["name"]: column for column in inspector.get_columns("suggestions")}
    for column_name in ("extraction_error", "extraction_status"):
        if column_name in suggestion_columns:
            op.drop_column("suggestions", column_name)

    if any(
        index["name"] == "ix_gmail_messages_content_hash"
        for index in inspector.get_indexes("gmail_messages")
    ):
        op.drop_index("ix_gmail_messages_content_hash", table_name="gmail_messages")

    # The old experiment left comments referring to now-removed body storage.
    # SQLite does not support column comments, so only clear them on PostgreSQL.
    if bind.dialect.name == "postgresql":
        op.alter_column(
            "gmail_messages", "content_hash", existing_type=sa.String(length=64), comment=None
        )
        op.alter_column(
            "suggestions", "timezone", existing_type=sa.String(length=100), comment=None
        )


def downgrade() -> None:
    # Dropped experimental fields contained no application-owned data.
    pass
