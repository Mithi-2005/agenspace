import uuid
from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.event import Event, EventSource
from app.schemas.event import EventCreate, EventUpdate


def create_event(db: Session, user_id: uuid.UUID, payload: EventCreate) -> Event:
    starts_at, ends_at = _all_day_bounds(
        payload.starts_at, payload.timezone, payload.all_day, payload.ends_at
    )
    event = Event(
        user_id=user_id,
        title=payload.title,
        description=payload.description,
        starts_at=starts_at,
        ends_at=ends_at,
        location=payload.location,
        timezone=payload.timezone,
        all_day=payload.all_day,
        source=EventSource.user,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def list_events(
    db: Session,
    user_id: uuid.UUID,
    starts_after: datetime | None = None,
    starts_before: datetime | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[Event], int]:
    query = select(Event).where(Event.user_id == user_id)
    count_query = select(func.count()).select_from(Event).where(Event.user_id == user_id)

    if starts_after is not None:
        query = query.where(Event.starts_at >= starts_after)
        count_query = count_query.where(Event.starts_at >= starts_after)

    if starts_before is not None:
        query = query.where(Event.starts_at <= starts_before)
        count_query = count_query.where(Event.starts_at <= starts_before)

    query = query.order_by(Event.starts_at.asc())
    query = query.limit(limit).offset(offset)

    items = list(db.scalars(query).all())
    total = db.scalar(count_query) or 0
    return items, total


def get_event(db: Session, user_id: uuid.UUID, event_id: uuid.UUID) -> Event | None:
    return db.scalar(select(Event).where(Event.id == event_id, Event.user_id == user_id))


def update_event(
    db: Session,
    event: Event,
    payload: EventUpdate,
) -> Event:
    now = datetime.now(UTC)

    if payload.title is not None:
        event.title = payload.title
    if "description" in payload.model_fields_set:
        event.description = payload.description
    if payload.starts_at is not None:
        event.starts_at = payload.starts_at
    if "ends_at" in payload.model_fields_set:
        event.ends_at = payload.ends_at
    if "location" in payload.model_fields_set:
        event.location = payload.location
    if "timezone" in payload.model_fields_set:
        event.timezone = payload.timezone
    if "all_day" in payload.model_fields_set and payload.all_day is not None:
        event.all_day = payload.all_day

    if event.all_day:
        event.starts_at, event.ends_at = _all_day_bounds(
            event.starts_at, event.timezone, True, event.ends_at
        )

    # Re-validate date range
    if event.ends_at is not None and event.ends_at <= event.starts_at:
        raise ValueError("ends_at must be after starts_at.")

    event.updated_at = now
    db.commit()
    db.refresh(event)
    return event


def delete_event(db: Session, event: Event) -> None:
    db.delete(event)
    db.commit()


def _all_day_bounds(
    starts_at: datetime,
    timezone: str | None,
    all_day: bool,
    ends_at: datetime | None,
) -> tuple[datetime, datetime | None]:
    if not all_day:
        return starts_at, ends_at
    zone = ZoneInfo(timezone or "UTC")
    local_date = starts_at.astimezone(zone).date()
    start = datetime.combine(local_date, time.min, zone)
    end = datetime.combine(local_date + timedelta(days=1), time.min, zone)
    return start, end
