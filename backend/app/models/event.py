import enum
import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class EventSource(str, enum.Enum):
    user = "user"           # Manually created
    imported = "imported"   # Imported from calendar/Gmail
    suggested = "suggested" # Detected, pending confirmation
    confirmed = "confirmed" # Detected and confirmed


class Event(Base):
    __tablename__ = "events"

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
    title: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    starts_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    ends_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    location: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    source: Mapped[EventSource] = mapped_column(
        Enum(EventSource, name="event_source", create_type=True),
        default=EventSource.user,
        nullable=False,
    )
    external_id: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="External identifier from calendar/mail provider",
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

    user: Mapped["User"] = relationship("User", back_populates="events")

    __table_args__ = (
        CheckConstraint("ends_at > starts_at", name="ck_events_end_after_start"),
        Index("ix_events_user_starts", "user_id", "starts_at"),
    )
