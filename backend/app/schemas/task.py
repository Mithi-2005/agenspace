import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.task import TaskPriority, TaskStatus


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = Field(None, max_length=10000)
    priority: TaskPriority = TaskPriority.none
    due_at: datetime | None = None

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be empty or solely whitespace.")
        return v

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, v: object) -> object:
        if isinstance(v, str):
            v = v.strip()
            return v if v else None
        return v


class TaskUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=500)
    description: str | None = None
    priority: TaskPriority | None = None
    due_at: datetime | None = None
    status: TaskStatus | None = None

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be empty or solely whitespace.")
        return v


class TaskResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    title: str
    description: str | None
    status: TaskStatus
    priority: TaskPriority
    due_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class TaskListResponse(BaseModel):
    items: list[TaskResponse]
    total: int
