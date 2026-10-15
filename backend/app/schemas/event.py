import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.event import EventSource


class EventCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = Field(None, max_length=10000)
    starts_at: datetime
    ends_at: datetime
    location: str | None = Field(None, max_length=500)

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be empty or solely whitespace.")
        return v

    @model_validator(mode="after")
    def validate_date_range(self) -> "EventCreate":
        if self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be after starts_at.")
        return self


class EventUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=500)
    description: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    location: str | None = None

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be empty or solely whitespace.")
        return v

    @model_validator(mode="after")
    def validate_date_range(self) -> "EventUpdate":
        if (
            self.starts_at is not None
            and self.ends_at is not None
            and self.ends_at <= self.starts_at
        ):
            raise ValueError("ends_at must be after starts_at.")
        return self


class EventResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    title: str
    description: str | None
    starts_at: datetime
    ends_at: datetime
    location: str | None
    source: EventSource
    created_at: datetime
    updated_at: datetime


class EventListResponse(BaseModel):
    items: list[EventResponse]
    total: int
