from datetime import datetime
from email.utils import parseaddr

from pydantic import BaseModel, Field, field_validator


class GmailSyncResponse(BaseModel):
    status: str
    messages_synced: int
    suggestions_created: int
    extraction_failures: int = 0
    fetch_failures: int = 0
    last_synced_at: datetime | None = None


class GmailSendRequest(BaseModel):
    to: str = Field(min_length=3, max_length=320)
    subject: str = Field(min_length=1, max_length=998)
    body: str = Field(min_length=1, max_length=100_000)
    confirmed: bool

    @field_validator("subject")
    @classmethod
    def subject_has_no_header_breaks(cls, value: str) -> str:
        if "\r" in value or "\n" in value:
            raise ValueError("Subject must be a single line.")
        return value

    @field_validator("to")
    @classmethod
    def recipient_is_a_single_email(cls, value: str) -> str:
        if "\r" in value or "\n" in value:
            raise ValueError("Recipient must be a single email address.")
        display_name, address = parseaddr(value)
        if display_name or address != value or "@" not in address:
            raise ValueError("Recipient must be a single email address.")
        return value


class GmailMessageActionRequest(BaseModel):
    message_id_confirmation: str


class GmailPermanentDeleteRequest(BaseModel):
    confirmation_phrase: str

