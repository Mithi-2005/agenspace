"""
Task and event suggestions API routes.

Provides endpoints for retrieving pending suggestions, accepting them into real tasks/events,
and dismissing unwanted suggestions.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.plugins.gmail.suggestions import (
    SuggestionError,
    SuggestionNotFoundError,
    accept_suggestion,
    dismiss_suggestion,
    list_pending_suggestions,
)
from app.schemas.suggestion import SuggestionResponse

router = APIRouter()


@router.get(
    "",
    response_model=list[SuggestionResponse],
    summary="List pending task and event suggestions for the current user",
)
def list_suggestions(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[SuggestionResponse]:
    """Retrieve all pending suggestions derived from integration sync."""
    items = list_pending_suggestions(db, current_user.id)
    return [
        SuggestionResponse.model_validate(item).model_copy(
            update={
                "source_message_id": item.message.message_id if item.message else None,
                "source_snippet": item.message.snippet if item.message else None,
            }
        )
        for item in items
    ]


@router.post(
    "/{suggestion_id}/accept",
    summary="Accept a suggestion and create a confirmed Task or Event",
)
def accept_single_suggestion(
    suggestion_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """Accept a suggestion, converting it into a user-owned confirmed task or event."""
    try:
        sug, item = accept_suggestion(db, current_user.id, suggestion_id)
    except SuggestionNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except SuggestionError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    return {
        "status": "accepted",
        "suggestion_id": str(sug.id),
        "created_type": sug.suggestion_type.value,
        "item_id": str(item.id),
        "title": item.title,
    }


@router.post(
    "/{suggestion_id}/dismiss",
    summary="Dismiss a suggestion",
)
def dismiss_single_suggestion(
    suggestion_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """Dismiss a suggestion so it is no longer shown in review feeds."""
    try:
        sug = dismiss_suggestion(db, current_user.id, suggestion_id)
    except SuggestionNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    return {
        "status": "dismissed",
        "suggestion_id": str(sug.id),
    }
