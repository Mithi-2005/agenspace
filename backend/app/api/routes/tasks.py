import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.task import TaskStatus
from app.models.user import User
from app.schemas.task import TaskCreate, TaskListResponse, TaskResponse, TaskUpdate
from app.services.task_service import (
    complete_task,
    create_task,
    delete_task,
    get_task,
    list_tasks,
    reopen_task,
    update_task,
)

router = APIRouter()


@router.post(
    "",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new task",
)
def create(
    payload: TaskCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> TaskResponse:
    task = create_task(db=db, user_id=current_user.id, payload=payload)
    return TaskResponse.model_validate(task)


@router.get(
    "",
    response_model=TaskListResponse,
    summary="List the current user's tasks",
)
def list_all(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    task_status: Annotated[TaskStatus | None, Query(alias="status")] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> TaskListResponse:
    items, total = list_tasks(
        db=db, user_id=current_user.id, status=task_status, limit=limit, offset=offset
    )
    return TaskListResponse(
        items=[TaskResponse.model_validate(t) for t in items],
        total=total,
    )


@router.get(
    "/{task_id}",
    response_model=TaskResponse,
    summary="Retrieve a single task",
)
def get_one(
    task_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> TaskResponse:
    task = get_task(db=db, user_id=current_user.id, task_id=task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")
    return TaskResponse.model_validate(task)


@router.patch(
    "/{task_id}",
    response_model=TaskResponse,
    summary="Update a task",
)
def update(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> TaskResponse:
    task = get_task(db=db, user_id=current_user.id, task_id=task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")
    updated = update_task(db=db, task=task, payload=payload)
    return TaskResponse.model_validate(updated)


@router.post(
    "/{task_id}/complete",
    response_model=TaskResponse,
    summary="Mark a task as complete",
)
def complete(
    task_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> TaskResponse:
    task = get_task(db=db, user_id=current_user.id, task_id=task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")
    completed = complete_task(db=db, task=task)
    return TaskResponse.model_validate(completed)


@router.post(
    "/{task_id}/reopen",
    response_model=TaskResponse,
    summary="Reopen a completed task",
)
def reopen(
    task_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> TaskResponse:
    task = get_task(db=db, user_id=current_user.id, task_id=task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")
    reopened = reopen_task(db=db, task=task)
    return TaskResponse.model_validate(reopened)


@router.delete(
    "/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a task",
)
def delete(
    task_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    task = get_task(db=db, user_id=current_user.id, task_id=task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")
    delete_task(db=db, task=task)
