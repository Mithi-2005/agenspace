import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.task import Task, TaskStatus
from app.schemas.task import TaskCreate, TaskUpdate


def create_task(db: Session, user_id: uuid.UUID, payload: TaskCreate) -> Task:
    task = Task(
        user_id=user_id,
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        due_at=payload.due_at,
        status=TaskStatus.open,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def list_tasks(
    db: Session,
    user_id: uuid.UUID,
    status: TaskStatus | None = None,
    due_before: datetime | None = None,
    due_after: datetime | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[Task], int]:
    query = select(Task).where(Task.user_id == user_id)
    count_query = select(func.count()).select_from(Task).where(Task.user_id == user_id)

    if status is not None:
        query = query.where(Task.status == status)
        count_query = count_query.where(Task.status == status)

    if due_before is not None:
        query = query.where(Task.due_at <= due_before)
        count_query = count_query.where(Task.due_at <= due_before)

    if due_after is not None:
        query = query.where(Task.due_at >= due_after)
        count_query = count_query.where(Task.due_at >= due_after)

    query = query.order_by(Task.due_at.asc().nulls_last(), Task.created_at.desc())
    query = query.limit(limit).offset(offset)

    items = list(db.scalars(query).all())
    total = db.scalar(count_query) or 0
    return items, total


def get_task(db: Session, user_id: uuid.UUID, task_id: uuid.UUID) -> Task | None:
    return db.scalar(
        select(Task).where(Task.id == task_id, Task.user_id == user_id)
    )


def update_task(
    db: Session,
    task: Task,
    payload: TaskUpdate,
) -> Task:
    now = datetime.now(UTC)

    if payload.title is not None:
        task.title = payload.title
    if payload.description is not None:
        task.description = payload.description
    if "description" in payload.model_fields_set and payload.description is None:
        task.description = None
    if payload.priority is not None:
        task.priority = payload.priority
    if "due_at" in payload.model_fields_set:
        task.due_at = payload.due_at
    if payload.status is not None:
        old_status = task.status
        task.status = payload.status
        if payload.status == TaskStatus.completed and old_status != TaskStatus.completed:
            task.completed_at = now
        elif payload.status == TaskStatus.open:
            task.completed_at = None

    task.updated_at = now
    db.commit()
    db.refresh(task)
    return task


def delete_task(db: Session, task: Task) -> None:
    db.delete(task)
    db.commit()


def complete_task(db: Session, task: Task) -> Task:
    task.status = TaskStatus.completed
    task.completed_at = datetime.now(UTC)
    task.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(task)
    return task


def reopen_task(db: Session, task: Task) -> Task:
    task.status = TaskStatus.open
    task.completed_at = None
    task.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(task)
    return task
