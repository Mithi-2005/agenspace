"""
Heuristic task and event suggestion engine.

Analyzes synchronized email metadata (subject, sender, snippet, timestamps) using deterministic
heuristics to extract potential action items and events for explicit user review.

Engineering & Safety Guarantees
-------------------------------
1. Deterministic & LLM-Free:
   Operates strictly on bounded regex and keyword heuristics. Never calls external AI services.

2. Conservative Date Parsing:
   Never invents arbitrary dates or times from vague language like "asap" or "later".
   Only explicit recognizable date structures produce a `suggested_date`.

3. Non-Destructive / Tentative:
   Never automatically creates confirmed tasks or events. Suggestions remain in `pending`
   status until the user explicitly accepts or dismisses them.

4. Deduplication & Provenance:
   Every suggestion has a stable `(user_id, dedup_key)` preventing duplicate suggestions
   even across multiple sync cycles. Full provenance (sender, subject, reason) is preserved.
"""

import logging
import re
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.event import Event, EventSource
from app.models.integration import GmailMessage, Suggestion, SuggestionStatus, SuggestionType
from app.models.task import Task, TaskPriority, TaskSource, TaskStatus

logger = logging.getLogger("kosway.integrations.google.suggestions")

# Heuristic patterns for tasks
TASK_PATTERNS = [
    (r"\b(assignment|homework|lab report|problem set)\b", "high", "Academic assignment detected"),
    (r"\b(due date|deadline|due by|submit by|submission deadline)\b", "high", "Explicit deadline detected"),
    (r"\b(action required|please review|please complete|fill out|rsvp by)\b", "medium", "Action item requested"),
    (r"\b(invoice|bill due|payment due)\b", "high", "Financial deadline detected"),
]

# Heuristic patterns for events
EVENT_PATTERNS = [
    (r"\b(interview|office hours|advising session)\b", "high", "Academic or professional appointment detected"),
    (r"\b(meeting|webinar|call scheduled|zoom meeting|google meet)\b", "medium", "Meeting or conference detected"),
    (r"\b(invitation to|invited you to|calendar invite)\b", "medium", "Calendar invitation detected"),
    (r"\b(lecture|symposium|orientation|workshop)\b", "high", "Scheduled event detected"),
]


class SuggestionError(Exception):
    """Base exception for suggestion service operations."""


class SuggestionNotFoundError(SuggestionError):
    """Raised when a suggestion is not found or does not belong to the user."""


def generate_suggestions_for_user(db: Session, user_id: uuid.UUID) -> int:
    """
    Scan unsuggested Gmail messages for the user and generate suggestions.

    Returns
    -------
    int
        Number of new suggestions created.
    """
    messages = list(
        db.scalars(
            select(GmailMessage)
            .where(GmailMessage.user_id == user_id)
            .order_by(GmailMessage.received_at.desc())
            .limit(50)
        ).all()
    )

    created_count = 0
    for msg in messages:
        created_count += _analyze_message(db, user_id, msg)

    if created_count > 0:
        db.commit()

    return created_count


def _analyze_message(db: Session, user_id: uuid.UUID, msg: GmailMessage) -> int:
    """Analyze a single message and create suggestions if matched."""
    text_to_scan = f"{msg.subject} {msg.snippet or ''}".lower()
    created = 0

    # 1. Check for Event patterns
    for pattern, confidence, reason in EVENT_PATTERNS:
        match = re.search(pattern, text_to_scan, re.IGNORECASE)
        if match:
            dedup_key = f"{msg.message_id}:event:{match.group(1).lower()}"
            existing = db.scalar(
                select(Suggestion).where(
                    Suggestion.user_id == user_id,
                    Suggestion.dedup_key == dedup_key,
                )
            )
            if existing is None:
                suggested_start = _parse_date_hint(text_to_scan, msg.received_at)
                suggested_end = (suggested_start + timedelta(hours=1)) if suggested_start else None

                sug = Suggestion(
                    user_id=user_id,
                    message_id=msg.id,
                    suggestion_type=SuggestionType.event,
                    dedup_key=dedup_key,
                    title=f"{msg.subject[:200]}",
                    description=msg.snippet[:500] if msg.snippet else None,
                    suggested_date=suggested_start,
                    suggested_end_date=suggested_end,
                    source_email_from=msg.sender[:255],
                    source_email_subject=msg.subject[:500],
                    confidence=confidence,
                    reasons=reason,
                    status=SuggestionStatus.pending,
                )
                db.add(sug)
                created += 1
            break  # One event suggestion per message is sufficient

    # 2. Check for Task patterns
    for pattern, confidence, reason in TASK_PATTERNS:
        match = re.search(pattern, text_to_scan, re.IGNORECASE)
        if match:
            dedup_key = f"{msg.message_id}:task:{match.group(1).lower()}"
            existing = db.scalar(
                select(Suggestion).where(
                    Suggestion.user_id == user_id,
                    Suggestion.dedup_key == dedup_key,
                )
            )
            if existing is None:
                suggested_due = _parse_date_hint(text_to_scan, msg.received_at)

                sug = Suggestion(
                    user_id=user_id,
                    message_id=msg.id,
                    suggestion_type=SuggestionType.task,
                    dedup_key=dedup_key,
                    title=f"Action: {msg.subject[:200]}",
                    description=msg.snippet[:500] if msg.snippet else None,
                    suggested_date=suggested_due,
                    source_email_from=msg.sender[:255],
                    source_email_subject=msg.subject[:500],
                    confidence=confidence,
                    reasons=reason,
                    status=SuggestionStatus.pending,
                )
                db.add(sug)
                created += 1
            break  # One task suggestion per message is sufficient

    return created


def _parse_date_hint(text: str, base_date: datetime) -> datetime | None:
    """
    Conservative date extraction from text.

    Supports:
      - "tomorrow" -> base_date + 1 day (17:00 UTC)
      - Explicit ISO date like "2026-10-25"
      - Month name and day like "Oct 24" or "November 15"
    Returns None if no unambiguous date signal is found.
    """
    # 1. "tomorrow"
    if re.search(r"\btomorrow\b", text, re.IGNORECASE):
        d = base_date + timedelta(days=1)
        return d.replace(hour=17, minute=0, second=0, microsecond=0)

    # 2. ISO dates: YYYY-MM-DD
    iso_match = re.search(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b", text)
    if iso_match:
        try:
            year, month, day = int(iso_match.group(1)), int(iso_match.group(2)), int(iso_match.group(3))
            return datetime(year, month, day, 17, 0, 0, tzinfo=UTC)
        except ValueError:
            pass

    # 3. Month + Day: e.g. "Oct 25" or "October 25"
    month_match = re.search(
        r"\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b",
        text,
        re.IGNORECASE,
    )
    if month_match:
        month_str = month_match.group(1)[:3].lower()
        day = int(month_match.group(2))
        month_map = {
            "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
            "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
        }
        month = month_map.get(month_str, 1)
        year = base_date.year
        try:
            target = datetime(year, month, day, 17, 0, 0, tzinfo=UTC)
            # If date already passed in this year, assume next year
            if target < base_date - timedelta(days=30):
                target = target.replace(year=year + 1)
            return target
        except ValueError:
            pass

    return None


def list_pending_suggestions(db: Session, user_id: uuid.UUID) -> list[Suggestion]:
    """Retrieve all pending suggestions for the user."""
    return list(
        db.scalars(
            select(Suggestion)
            .where(
                Suggestion.user_id == user_id,
                Suggestion.status == SuggestionStatus.pending,
            )
            .order_by(Suggestion.created_at.desc())
        ).all()
    )


def accept_suggestion(
    db: Session,
    user_id: uuid.UUID,
    suggestion_id: uuid.UUID,
) -> tuple[Suggestion, Task | Event]:
    """
    Accept a suggestion and create the corresponding confirmed Task or Event.

    Guarantees user isolation and idempotency.
    """
    suggestion = db.scalar(
        select(Suggestion).where(
            Suggestion.id == suggestion_id,
            Suggestion.user_id == user_id,
        )
    )
    if suggestion is None:
        raise SuggestionNotFoundError("Suggestion not found or not owned by user.")

    # Idempotent: if already accepted, return existing linked item
    if suggestion.status == SuggestionStatus.accepted:
        if suggestion.actioned_task_id:
            existing_task = db.scalar(select(Task).where(Task.id == suggestion.actioned_task_id))
            if existing_task:
                return suggestion, existing_task
        if suggestion.actioned_event_id:
            existing_event = db.scalar(select(Event).where(Event.id == suggestion.actioned_event_id))
            if existing_event:
                return suggestion, existing_event

    item: Task | Event
    if suggestion.suggestion_type == SuggestionType.task:
        task = Task(
            user_id=user_id,
            title=suggestion.title,
            description=f"Derived from email: '{suggestion.source_email_subject}'\n\n{suggestion.description or ''}",
            priority=TaskPriority.medium,
            status=TaskStatus.open,
            source=TaskSource.confirmed,
            due_at=suggestion.suggested_date,
        )
        db.add(task)
        db.flush()
        suggestion.actioned_task_id = task.id
        item = task
    else:
        starts_at = suggestion.suggested_date or datetime.now(UTC) + timedelta(days=1)
        ends_at = suggestion.suggested_end_date or (starts_at + timedelta(hours=1))
        event = Event(
            user_id=user_id,
            title=suggestion.title,
            description=f"Derived from email: '{suggestion.source_email_subject}'\n\n{suggestion.description or ''}",
            starts_at=starts_at,
            ends_at=ends_at,
            source=EventSource.confirmed,
        )
        db.add(event)
        db.flush()
        suggestion.actioned_event_id = event.id
        item = event

    suggestion.status = SuggestionStatus.accepted
    suggestion.updated_at = datetime.now(UTC)
    db.commit()

    return suggestion, item


def dismiss_suggestion(
    db: Session,
    user_id: uuid.UUID,
    suggestion_id: uuid.UUID,
) -> Suggestion:
    """Mark a suggestion as dismissed."""
    suggestion = db.scalar(
        select(Suggestion).where(
            Suggestion.id == suggestion_id,
            Suggestion.user_id == user_id,
        )
    )
    if suggestion is None:
        raise SuggestionNotFoundError("Suggestion not found or not owned by user.")

    suggestion.status = SuggestionStatus.dismissed
    suggestion.updated_at = datetime.now(UTC)
    db.commit()

    return suggestion
