import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.session import RefreshTokenSession
from app.models.user import User


def get_user_by_id(db: Session, user_id: uuid.UUID) -> User | None:
    return db.scalar(select(User).where(User.id == user_id))


def get_user_by_email(db: Session, email: str) -> User | None:
    normalized = email.strip().lower()
    return db.scalar(select(User).where(User.email == normalized))


def create_user(
    db: Session,
    email: str,
    display_name: str,
    password: str,
) -> User:
    normalized_email = email.strip().lower()

    # Pre-check to provide a clean conflict message
    existing = get_user_by_email(db, normalized_email)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    hashed_pw = hash_password(password)
    user = User(
        email=normalized_email,
        display_name=display_name.strip(),
        password_hash=hashed_pw,
        is_active=True,
        is_verified=False,
    )

    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        ) from exc

    return user


def update_user_profile(
    db: Session,
    user: User,
    display_name: str,
) -> User:
    user.display_name = display_name.strip()
    user.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(user)
    return user


def change_user_password(
    db: Session,
    user: User,
    current_password: str,
    new_password: str,
) -> None:
    if not verify_password(current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    user.password_hash = hash_password(new_password)
    user.updated_at = datetime.now(UTC)

    # Invalidate all active sessions for security when password changes
    db.execute(
        update(RefreshTokenSession)
        .where(RefreshTokenSession.user_id == user.id)
        .values(is_revoked=True, updated_at=datetime.now(UTC))
    )
    db.commit()
