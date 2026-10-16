import enum
import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.external_account import ExternalAccount
    from app.models.user import User


class GmailMessage(Base):
    """
    Stores minimal metadata for synchronized Gmail messages.

    Security constraints:
      • Strictly user-scoped with CASCADE deletion when user or account is removed.
      • Minimal data stored: sender, subject, snippet, timestamps.
      • Full email bodies and attachments are NEVER stored.
      • Deduplication enforced per user and Gmail message ID.
    """
    __tablename__ = "gmail_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    external_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("external_accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    message_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    thread_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    sender: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    recipient: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    subject: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )
    snippet: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User")
    external_account: Mapped["ExternalAccount"] = relationship("ExternalAccount")

    __table_args__ = (
        UniqueConstraint("user_id", "message_id", name="uq_gmail_messages_user_message"),
        Index("ix_gmail_messages_user_received", "user_id", "received_at"),
    )


class IntegrationSyncState(Base):
    """
    Tracks the synchronization cursor and status for an external provider connection.
    """
    __tablename__ = "integration_sync_states"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    external_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("external_accounts.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    last_history_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    last_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    last_sync_status: Mapped[str] = mapped_column(
        String(50),
        default="idle",
        nullable=False,
    )
    last_error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    external_account: Mapped["ExternalAccount"] = relationship("ExternalAccount")


class SuggestionType(str, enum.Enum):
    task = "task"
    event = "event"


class SuggestionStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    dismissed = "dismissed"


class Suggestion(Base):
    """
    A detected task or event suggestion derived from synchronized email messages.

    Suggestions are tentative until explicitly accepted or dismissed by the user.
    """
    __tablename__ = "suggestions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    message_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("gmail_messages.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    suggestion_type: Mapped[SuggestionType] = mapped_column(
        Enum(SuggestionType, name="suggestion_type", create_type=True),
        nullable=False,
    )
    dedup_key: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    suggested_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    suggested_end_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    source_email_from: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    source_email_subject: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )
    confidence: Mapped[str] = mapped_column(
        String(50),
        default="medium",
        nullable=False,
    )
    reasons: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    status: Mapped[SuggestionStatus] = mapped_column(
        Enum(SuggestionStatus, name="suggestion_status", create_type=True),
        default=SuggestionStatus.pending,
        nullable=False,
        index=True,
    )
    actioned_task_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="SET NULL"),
        nullable=True,
    )
    actioned_event_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User")
    message: Mapped["GmailMessage | None"] = relationship("GmailMessage")

    __table_args__ = (
        UniqueConstraint("user_id", "dedup_key", name="uq_suggestions_user_dedup_key"),
        Index("ix_suggestions_user_status", "user_id", "status"),
    )
