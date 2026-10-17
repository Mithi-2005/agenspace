"""Reconnect databases stamped by the reverted Gmail intelligence attempt.

Revision ID: c8f4a2b1d9e6
Revises: 9a8ccceee3e5
"""

from collections.abc import Sequence

revision: str = "c8f4a2b1d9e6"
down_revision: str | None = "9a8ccceee3e5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # The database carrying this revision already has its experimental schema.
    # A clean install only needs this node to reconnect the migration history.
    pass


def downgrade() -> None:
    # No schema changes are owned by this history-reconnection marker.
    pass
