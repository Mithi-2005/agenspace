from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.session import get_db

router = APIRouter()


@router.get("/health", summary="Check API liveness")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready", summary="Check database readiness")
def ready(db: Annotated[Session, Depends(get_db)]) -> dict[str, str | dict[str, str]]:
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"status": "not_ready", "checks": {"database": "unavailable"}},
        ) from exc
    return {"status": "ready", "checks": {"database": "ok"}}
