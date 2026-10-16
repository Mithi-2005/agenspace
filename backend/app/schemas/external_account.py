import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.external_account import ExternalAccountStatus


class ExternalAccountResponse(BaseModel):
    """
    Public schema for connected external account metadata.

    Security rule: NEVER expose encrypted or decrypted tokens in response schemas.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    provider: str
    provider_user_id: str
    email: str | None = None
    scopes: str | None = None
    status: ExternalAccountStatus
    token_expires_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
