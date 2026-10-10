import uuid
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    generate_opaque_refresh_token,
    hash_token,
    verify_password,
)
from app.models.session import RefreshTokenSession
from app.models.user import User


def authenticate_user(db: Session, email: str, password: str) -> User:
    normalized_email = email.strip().lower()
    user = db.scalar(select(User).where(User.email == normalized_email))

    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled.",
        )

    user.last_login_at = datetime.now(UTC)
    db.commit()
    return user


def create_refresh_session(
    db: Session,
    user: User,
    user_agent: str | None = None,
    ip_address: str | None = None,
    family_id: uuid.UUID | None = None,
) -> tuple[str, RefreshTokenSession]:
    settings = get_settings()
    raw_token = generate_opaque_refresh_token()
    token_hash = hash_token(raw_token)

    session = RefreshTokenSession(
        user_id=user.id,
        token_hash=token_hash,
        family_id=family_id or uuid.uuid4(),
        is_revoked=False,
        expires_at=datetime.now(UTC)
        + timedelta(days=settings.refresh_token_expire_days),
        user_agent=user_agent,
        ip_address=ip_address,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return raw_token, session


def rotate_refresh_token(
    db: Session,
    raw_token: str,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> tuple[User, str, str, int]:
    """
    Safely rotate a refresh token and return (user, access_token, new_raw_token, expires_in).
    Detects reuse and revokes entire token family on reuse attempt.
    Uses pessimistic row locking to prevent race conditions during rotation.
    """
    settings = get_settings()
    token_hash = hash_token(raw_token)

    # Note: with_for_update() locks the session row for concurrency safety
    session = db.scalar(
        select(RefreshTokenSession)
        .where(RefreshTokenSession.token_hash == token_hash)
        .with_for_update()
    )

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Token reuse detection
    if session.is_revoked:
        # Revoke the entire family for security
        db.execute(
            update(RefreshTokenSession)
            .where(RefreshTokenSession.family_id == session.family_id)
            .values(is_revoked=True, updated_at=datetime.now(UTC))
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token. Session chain revoked for security.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Expiry check
    now = datetime.now(UTC)
    if session.expires_at <= now:
        session.is_revoked = True
        session.updated_at = now
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.scalar(select(User).where(User.id == session.user_id))
    if user is None or not user.is_active:
        session.is_revoked = True
        session.updated_at = now
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled.",
        )

    # Mark old session as revoked
    session.is_revoked = True
    session.updated_at = now

    # Issue new refresh token in the same family
    new_raw_token = generate_opaque_refresh_token()
    new_token_hash = hash_token(new_raw_token)
    new_session = RefreshTokenSession(
        user_id=user.id,
        token_hash=new_token_hash,
        family_id=session.family_id,
        is_revoked=False,
        expires_at=now + timedelta(days=settings.refresh_token_expire_days),
        user_agent=user_agent or session.user_agent,
        ip_address=ip_address or session.ip_address,
    )
    db.add(new_session)
    db.commit()

    # Generate new short-lived access token
    access_token, expires_in = create_access_token(user.id)
    return user, access_token, new_raw_token, expires_in


def revoke_refresh_session(db: Session, raw_token: str) -> bool:
    token_hash = hash_token(raw_token)
    session = db.scalar(
        select(RefreshTokenSession).where(RefreshTokenSession.token_hash == token_hash)
    )
    if session is not None and not session.is_revoked:
        session.is_revoked = True
        session.updated_at = datetime.now(UTC)
        db.commit()
        return True
    return False


def revoke_all_user_sessions(db: Session, user_id: uuid.UUID) -> int:
    result = db.execute(
        update(RefreshTokenSession)
        .where(
            RefreshTokenSession.user_id == user_id,
            RefreshTokenSession.is_revoked.is_(False),
        )
        .values(is_revoked=True, updated_at=datetime.now(UTC))
    )
    db.commit()
    return result.rowcount or 0
