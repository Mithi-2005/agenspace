"""Remove raw email bodies left by the reverted Gmail experiment.

Revision ID: d2f6a1c8b503
Revises: c94152ab781f
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d2f6a1c8b503"
down_revision: str | None = "c94152ab781f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("gmail_messages")}
    if "body_text" in columns:
        op.drop_column("gmail_messages", "body_text")


def downgrade() -> None:
    # The old email bodies were intentionally discarded and cannot be restored.
    pass
