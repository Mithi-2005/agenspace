import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SuggestionResponse(BaseModel):
    """Public schema for task/event suggestions."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_message_id: str | None = None
    source_snippet: str | None = None
    suggestion_type: str
    title: str
    description: str | None = None
    suggested_date: datetime | None = None
    suggested_end_date: datetime | None = None
    priority: str | None = None
    timezone: str | None = None
    all_day: bool = False
    location: str | None = None
    source_email_from: str
    source_email_subject: str
    confidence: str
    reasons: str | None = None
    status: str
    created_at: datetime
