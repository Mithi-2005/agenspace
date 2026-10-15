import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.event import EventCreate, EventListResponse, EventResponse, EventUpdate
from app.services.event_service import (
    create_event,
    delete_event,
    get_event,
    list_events,
    update_event,
)

router = APIRouter()


@router.post(
    "",
    response_model=EventResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new event",
)
def create(
    payload: EventCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> EventResponse:
    event = create_event(db=db, user_id=current_user.id, payload=payload)
    return EventResponse.model_validate(event)


@router.get(
    "",
    response_model=EventListResponse,
    summary="List the current user's events",
)
def list_all(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    starts_after: Annotated[datetime | None, Query()] = None,
    starts_before: Annotated[datetime | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> EventListResponse:
    items, total = list_events(
        db=db,
        user_id=current_user.id,
        starts_after=starts_after,
        starts_before=starts_before,
        limit=limit,
        offset=offset,
    )
    return EventListResponse(
        items=[EventResponse.model_validate(e) for e in items],
        total=total,
    )


@router.get(
    "/{event_id}",
    response_model=EventResponse,
    summary="Retrieve a single event",
)
def get_one(
    event_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> EventResponse:
    event = get_event(db=db, user_id=current_user.id, event_id=event_id)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")
    return EventResponse.model_validate(event)


@router.patch(
    "/{event_id}",
    response_model=EventResponse,
    summary="Update an event",
)
def update(
    event_id: uuid.UUID,
    payload: EventUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> EventResponse:
    event = get_event(db=db, user_id=current_user.id, event_id=event_id)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")
    try:
        updated = update_event(db=db, event=event, payload=payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return EventResponse.model_validate(updated)


@router.delete(
    "/{event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an event",
)
def delete(
    event_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    event = get_event(db=db, user_id=current_user.id, event_id=event_id)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")
    delete_event(db=db, event=event)
