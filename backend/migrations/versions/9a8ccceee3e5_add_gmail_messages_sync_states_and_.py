"""add_gmail_messages_sync_states_and_suggestions

Revision ID: 9a8ccceee3e5
Revises: d7a9f77b1729
Create Date: 2026-10-15 12:08:48.960118
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "9a8ccceee3e5"
down_revision: str | None = "d7a9f77b1729"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "gmail_messages",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("external_account_id", sa.UUID(), nullable=False),
        sa.Column("message_id", sa.String(length=255), nullable=False),
        sa.Column("thread_id", sa.String(length=255), nullable=False),
        sa.Column("sender", sa.String(length=255), nullable=False),
        sa.Column("recipient", sa.String(length=255), nullable=True),
        sa.Column("subject", sa.String(length=500), nullable=False),
        sa.Column("snippet", sa.Text(), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["external_account_id"], ["external_accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "message_id", name="uq_gmail_messages_user_message"),
    )
    op.create_index(op.f("ix_gmail_messages_external_account_id"), "gmail_messages", ["external_account_id"], unique=False)
    op.create_index(op.f("ix_gmail_messages_received_at"), "gmail_messages", ["received_at"], unique=False)
    op.create_index(op.f("ix_gmail_messages_user_id"), "gmail_messages", ["user_id"], unique=False)
    op.create_index("ix_gmail_messages_user_received", "gmail_messages", ["user_id", "received_at"], unique=False)

    op.create_table(
        "integration_sync_states",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("external_account_id", sa.UUID(), nullable=False),
        sa.Column("last_history_id", sa.String(length=100), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_sync_status", sa.String(length=50), nullable=False),
        sa.Column("last_error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["external_account_id"], ["external_accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("external_account_id"),
    )

    op.create_table(
        "suggestions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("message_id", sa.UUID(), nullable=True),
        sa.Column("suggestion_type", sa.Enum("task", "event", name="suggestion_type"), nullable=False),
        sa.Column("dedup_key", sa.String(length=255), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("suggested_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("suggested_end_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source_email_from", sa.String(length=255), nullable=False),
        sa.Column("source_email_subject", sa.String(length=500), nullable=False),
        sa.Column("confidence", sa.String(length=50), nullable=False),
        sa.Column("reasons", sa.Text(), nullable=True),
        sa.Column("status", sa.Enum("pending", "accepted", "dismissed", name="suggestion_status"), nullable=False),
        sa.Column("actioned_task_id", sa.UUID(), nullable=True),
        sa.Column("actioned_event_id", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["actioned_event_id"], ["events.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["actioned_task_id"], ["tasks.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["message_id"], ["gmail_messages.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "dedup_key", name="uq_suggestions_user_dedup_key"),
    )
    op.create_index(op.f("ix_suggestions_message_id"), "suggestions", ["message_id"], unique=False)
    op.create_index(op.f("ix_suggestions_status"), "suggestions", ["status"], unique=False)
    op.create_index(op.f("ix_suggestions_user_id"), "suggestions", ["user_id"], unique=False)
    op.create_index("ix_suggestions_user_status", "suggestions", ["user_id", "status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_suggestions_user_status", table_name="suggestions")
    op.drop_index(op.f("ix_suggestions_user_id"), table_name="suggestions")
    op.drop_index(op.f("ix_suggestions_status"), table_name="suggestions")
    op.drop_index(op.f("ix_suggestions_message_id"), table_name="suggestions")
    op.drop_table("suggestions")
    sa.Enum(name="suggestion_type").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="suggestion_status").drop(op.get_bind(), checkfirst=True)

    op.drop_table("integration_sync_states")

    op.drop_index("ix_gmail_messages_user_received", table_name="gmail_messages")
    op.drop_index(op.f("ix_gmail_messages_user_id"), table_name="gmail_messages")
    op.drop_index(op.f("ix_gmail_messages_received_at"), table_name="gmail_messages")
    op.drop_index(op.f("ix_gmail_messages_external_account_id"), table_name="gmail_messages")
    op.drop_table("gmail_messages")
