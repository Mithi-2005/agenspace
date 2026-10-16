from datetime import datetime

from pydantic import BaseModel


class GoogleConnectionStatusResponse(BaseModel):
    provider: str = "google"
    is_connected: bool
    email: str | None = None
    status: str | None = None
    last_synced_at: datetime | None = None
    last_sync_status: str | None = None
    last_error_message: str | None = None


class GoogleSyncResponse(BaseModel):
    status: str
    messages_synced: int
    suggestions_created: int
    last_synced_at: str | None = None
