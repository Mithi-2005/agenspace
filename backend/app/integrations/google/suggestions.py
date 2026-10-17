"""Persistence and approval workflow for Gmail intelligence suggestions."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.event import Event, EventSource
from app.models.integration import GmailMessage, Suggestion, SuggestionStatus, SuggestionType
from app.models.task import Task, TaskPriority, TaskSource, TaskStatus
from app.services.gmail_intelligence_service import GmailExtraction


class SuggestionError(Exception):
    """Base exception for suggestion service operations."""


class SuggestionNotFoundError(SuggestionError):
    """Raised when a suggestion is not found or does not belong to the user."""


def persist_extraction(
    db: Session,
    user_id: uuid.UUID,
    msg: GmailMessage,
    extraction: GmailExtraction,
    content_hash: str,
) -> int:
    """Persist validated output idempotently, preserving dismissed suggestions."""
    created = 0
    seen_keys: set[str] = set()
    for item in extraction.suggestions:
        kind = SuggestionType(item.type)
        timestamp = item.due_at if kind == SuggestionType.task else item.starts_at
        stable_material = (
            f"{kind.value}|{item.title.casefold()}|{timestamp.isoformat() if timestamp else ''}|"
            f"{(item.description or '').casefold()}|{item.evidence.casefold()}"
        )
        identity = uuid.uuid5(uuid.NAMESPACE_URL, stable_material)
        dedup_key = f"{msg.message_id}:{content_hash[:12]}:{identity}"
        if dedup_key in seen_keys:
            continue
        seen_keys.add(dedup_key)
        existing = db.scalar(
            select(Suggestion).where(
                Suggestion.user_id == user_id, Suggestion.dedup_key == dedup_key
            )
        )
        if existing is not None:
            continue
        suggestion = Suggestion(
            user_id=user_id,
            message_id=msg.id,
            suggestion_type=kind,
            dedup_key=dedup_key,
            title=item.title[:500],
            description=item.description,
            suggested_date=timestamp.astimezone(UTC) if timestamp else None,
            suggested_end_date=item.ends_at.astimezone(UTC) if item.ends_at else None,
            source_email_from=msg.sender[:255],
            source_email_subject=msg.subject[:500],
            confidence=f"{item.confidence:.2f}",
            reasons=item.evidence,
            priority=item.priority,
            timezone=item.timezone,
            location=item.location,
            all_day=item.all_day,
            status=SuggestionStatus.pending,
        )
        db.add(suggestion)
        created += 1
    db.commit()
    return created


def list_pending_suggestions(db: Session, user_id: uuid.UUID) -> list[Suggestion]:
    return list(
        db.scalars(
            select(Suggestion)
            .where(Suggestion.user_id == user_id, Suggestion.status == SuggestionStatus.pending)
            .order_by(Suggestion.created_at.desc())
        ).all()
    )


def accept_suggestion(
    db: Session,
    user_id: uuid.UUID,
    suggestion_id: uuid.UUID,
) -> tuple[Suggestion, Task | Event]:
    suggestion = db.scalar(
        select(Suggestion)
        .where(Suggestion.id == suggestion_id, Suggestion.user_id == user_id)
        .with_for_update()
    )
    if suggestion is None:
        raise SuggestionNotFoundError("Suggestion not found or not owned by user.")

    if suggestion.status == SuggestionStatus.accepted:
        if suggestion.actioned_task_id:
            existing_task = db.scalar(
                select(Task).where(
                    Task.id == suggestion.actioned_task_id,
                    Task.user_id == user_id,
                )
            )
            if existing_task:
                return suggestion, existing_task
        if suggestion.actioned_event_id:
            existing_event = db.scalar(
                select(Event).where(
                    Event.id == suggestion.actioned_event_id,
                    Event.user_id == user_id,
                )
            )
            if existing_event:
                return suggestion, existing_event
        raise SuggestionError("This suggestion was already accepted, but its item no longer exists.")
    if suggestion.status == SuggestionStatus.dismissed:
        raise SuggestionError("Dismissed suggestions cannot be accepted. Retry extraction to review it again.")

    description = (
        f"Derived from email: '{suggestion.source_email_subject}'\n\n{suggestion.description or ''}"
    )
    if suggestion.suggestion_type == SuggestionType.task:
        priority = {
            "low": TaskPriority.low,
            "medium": TaskPriority.medium,
            "high": TaskPriority.high,
            "urgent": TaskPriority.high,
        }.get(suggestion.priority or "", TaskPriority.none)
        item: Task | Event = Task(
            user_id=user_id,
            title=suggestion.title,
            description=description,
            priority=priority,
            status=TaskStatus.open,
            source=TaskSource.confirmed,
            due_at=suggestion.suggested_date,
        )
        db.add(item)
        db.flush()
        suggestion.actioned_task_id = item.id
    else:
        if suggestion.suggested_date is None:
            raise SuggestionError("This event has no supported start time and cannot be added yet.")
        item = Event(
            user_id=user_id,
            title=suggestion.title,
            description=description,
            starts_at=suggestion.suggested_date,
            ends_at=suggestion.suggested_end_date,
            location=suggestion.location,
            timezone=suggestion.timezone,
            all_day=suggestion.all_day,
            source=EventSource.confirmed,
        )
        db.add(item)
        db.flush()
        suggestion.actioned_event_id = item.id

    suggestion.status = SuggestionStatus.accepted
    suggestion.updated_at = datetime.now(UTC)
    db.commit()
    return suggestion, item


def dismiss_suggestion(db: Session, user_id: uuid.UUID, suggestion_id: uuid.UUID) -> Suggestion:
    suggestion = db.scalar(
        select(Suggestion).where(Suggestion.id == suggestion_id, Suggestion.user_id == user_id)
    )
    if suggestion is None:
        raise SuggestionNotFoundError("Suggestion not found or not owned by user.")
    suggestion.status = SuggestionStatus.dismissed
    suggestion.updated_at = datetime.now(UTC)
    db.commit()
    return suggestion
