import enum
import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Index,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class ExternalAccountStatus(str, enum.Enum):
    active = "active"
    revoked = "revoked"
    error = "error"


class ExternalAccount(Base):
    """
    Stores credentials and metadata for external provider accounts (e.g. Google/Gmail)
    connected to an AgenSpace user.

    Security constraints:
      • OAuth access and refresh tokens are encrypted at rest using Fernet before insertion.
      • Raw plaintext tokens are NEVER stored in this table.
      • Token columns are never exposed in public schemas or logged.
      • One account per (user_id, provider) enforced by unique constraint.
    """

    __tablename__ = "external_accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    provider: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    provider_user_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    access_token_enc: Mapped[bytes] = mapped_column(
        LargeBinary,
        nullable=False,
    )
    refresh_token_enc: Mapped[bytes | None] = mapped_column(
        LargeBinary,
        nullable=True,
    )
    token_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    scopes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    status: Mapped[ExternalAccountStatus] = mapped_column(
        Enum(ExternalAccountStatus, name="external_account_status", create_type=True),
        default=ExternalAccountStatus.active,
        nullable=False,
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

    user: Mapped["User"] = relationship("User", back_populates="external_accounts")

    __table_args__ = (
        UniqueConstraint("user_id", "provider", name="uq_external_accounts_user_provider"),
        Index("ix_external_accounts_provider_sub", "provider", "provider_user_id"),
    )
