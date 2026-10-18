from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.event import Event
from app.models.task import Task, TaskStatus
from app.models.user import User
from app.plugins.gmail.suggestions import list_pending_suggestions
from app.schemas.event import EventResponse
from app.schemas.suggestion import SuggestionResponse
from app.schemas.task import TaskResponse

router = APIRouter()


class DashboardSummaryResponse(BaseModel):
    tasks_open: int
    tasks_due_today: int
    tasks_overdue: int
    tasks_completed: int
    today_tasks: list[TaskResponse]
    overdue_tasks: list[TaskResponse]
    upcoming_events: list[EventResponse]
    pending_suggestions: list[SuggestionResponse] = []


@router.get(
    "",
    response_model=DashboardSummaryResponse,
    summary="Dashboard aggregation for the current user",
)
def dashboard_summary(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> DashboardSummaryResponse:
    now = datetime.now(UTC)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    next_week = today_start + timedelta(days=7)

    # Counts
    tasks_open = db.scalar(
        select(func.count()).select_from(Task).where(
            Task.user_id == current_user.id,
            Task.status == TaskStatus.open,
        )
    ) or 0

    tasks_due_today = db.scalar(
        select(func.count()).select_from(Task).where(
            Task.user_id == current_user.id,
            Task.status == TaskStatus.open,
            Task.due_at >= today_start,
            Task.due_at < today_end,
        )
    ) or 0

    tasks_overdue = db.scalar(
        select(func.count()).select_from(Task).where(
            Task.user_id == current_user.id,
            Task.status == TaskStatus.open,
            Task.due_at < today_start,
        )
    ) or 0

    tasks_completed = db.scalar(
        select(func.count()).select_from(Task).where(
            Task.user_id == current_user.id,
            Task.status == TaskStatus.completed,
        )
    ) or 0

    # Today's tasks (due today, open)
    today_tasks = list(
        db.scalars(
            select(Task).where(
                Task.user_id == current_user.id,
                Task.status == TaskStatus.open,
                Task.due_at >= today_start,
                Task.due_at < today_end,
            ).order_by(Task.due_at.asc()).limit(10)
        ).all()
    )

    # Overdue tasks
    overdue_tasks = list(
        db.scalars(
            select(Task).where(
                Task.user_id == current_user.id,
                Task.status == TaskStatus.open,
                Task.due_at < today_start,
            ).order_by(Task.due_at.asc()).limit(5)
        ).all()
    )

    # Upcoming events (next 7 days)
    upcoming_events = list(
        db.scalars(
            select(Event).where(
                Event.user_id == current_user.id,
                Event.starts_at >= now,
                Event.starts_at <= next_week,
            ).order_by(Event.starts_at.asc()).limit(5)
        ).all()
    )

    # Pending integration suggestions
    pending_suggestions = list_pending_suggestions(db, current_user.id)

    return DashboardSummaryResponse(
        tasks_open=tasks_open,
        tasks_due_today=tasks_due_today,
        tasks_overdue=tasks_overdue,
        tasks_completed=tasks_completed,
        today_tasks=[TaskResponse.model_validate(t) for t in today_tasks],
        overdue_tasks=[TaskResponse.model_validate(t) for t in overdue_tasks],
        upcoming_events=[EventResponse.model_validate(e) for e in upcoming_events],
        pending_suggestions=[SuggestionResponse.model_validate(s) for s in pending_suggestions[:10]],
    )
