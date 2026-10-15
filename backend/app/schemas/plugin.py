import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PluginPublisher(BaseModel):
    name: str
    verified: bool
    support_url: str | None = None


class PluginPermission(BaseModel):
    scope: str
    description: str
    required: bool = True


class PluginLifecycle(BaseModel):
    """
    Explicitly separates the 5 stages of the integration lifecycle:
    1. Catalogue listing (exists in marketplace)
    2. User installation (selected/installed in workspace)
    3. External service authorization/connection
    4. Data synchronization
    5. Runtime capabilities for Moon/assistant execution
    """
    listing: str = Field(
        default="available",
        description="Catalogue listing state: available or hidden",
    )
    installation: str = Field(
        default="not_installed",
        description="User installation state: not_installed or installed",
    )
    connection: str = Field(
        default="unavailable",
        description="External provider authorization status. For planned integrations, accurately 'unavailable'.",
    )
    synchronization: str = Field(
        default="never",
        description="Data ingestion state: never, idle, syncing, synced, or error",
    )
    runtime_capabilities: str = Field(
        default="planned",
        description="Runtime execution readiness: planned, ready, or active",
    )


class PluginListing(BaseModel):
    id: str
    name: str
    summary: str
    description: str
    category: str
    icon: str
    publisher: PluginPublisher
    status: str = Field(
        default="planned",
        description="Development status: planned, beta, or available",
    )
    integration_status: str = Field(
        default="planned",
        description="Provider integration readiness label",
    )
    capabilities: list[str]
    permissions: list[PluginPermission]
    setup_requirements: str
    lifecycle: PluginLifecycle
    is_installed: bool = False
    installed_at: datetime | None = None
    is_enabled: bool = False


class PluginListResponse(BaseModel):
    items: list[PluginListing]
    total: int
    categories: list[str]


class InstalledPluginResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    plugin_id: str
    is_enabled: bool
    installed_at: datetime
