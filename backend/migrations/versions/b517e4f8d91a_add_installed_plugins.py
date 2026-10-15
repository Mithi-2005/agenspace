"""add_installed_plugins

Revision ID: b517e4f8d91a
Revises: 4e238fafcfad
Create Date: 2026-10-12 23:45:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b517e4f8d91a"
down_revision: str | None = "4e238fafcfad"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "installed_plugins",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("plugin_id", sa.String(length=100), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("installed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "plugin_id", name="uq_installed_plugins_user_plugin"),
    )
    op.create_index(op.f("ix_installed_plugins_user_id"), "installed_plugins", ["user_id"], unique=False)
    op.create_index(op.f("ix_installed_plugins_plugin_id"), "installed_plugins", ["plugin_id"], unique=False)
    op.create_index("ix_installed_plugins_user_enabled", "installed_plugins", ["user_id", "is_enabled"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_installed_plugins_user_enabled", table_name="installed_plugins")
    op.drop_index(op.f("ix_installed_plugins_plugin_id"), table_name="installed_plugins")
    op.drop_index(op.f("ix_installed_plugins_user_id"), table_name="installed_plugins")
    op.drop_table("installed_plugins")
