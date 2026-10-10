from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import (
    REFRESH_COOKIE_NAME,
    clear_refresh_cookie,
    get_current_user,
    set_refresh_cookie,
    verify_csrf_and_origin,
)
from app.core.rate_limiter import check_rate_limit
from app.core.security import create_access_token
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.user import UserResponse
from app.services.auth_service import (
    authenticate_user,
    create_refresh_session,
    revoke_all_user_sessions,
    revoke_refresh_session,
    rotate_refresh_token,
)
from app.services.user_service import create_user

router = APIRouter()


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
def register(
    request: Request,
    payload: RegisterRequest,
    db: Annotated[Session, Depends(get_db)],
) -> UserResponse:
    check_rate_limit(request, "auth_register")
    user = create_user(
        db=db,
        email=payload.email,
        display_name=payload.display_name,
        password=payload.password,
    )
    return UserResponse.model_validate(user)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate and receive access token + session cookie",
)
def login(
    request: Request,
    response: Response,
    payload: LoginRequest,
    db: Annotated[Session, Depends(get_db)],
    user_agent: Annotated[str | None, Header()] = None,
) -> TokenResponse:
    check_rate_limit(request, "auth_login")
    user = authenticate_user(db=db, email=payload.email, password=payload.password)

    client_ip = request.client.host if request.client else None
    raw_refresh_token, _ = create_refresh_session(
        db=db,
        user=user,
        user_agent=user_agent,
        ip_address=client_ip,
    )

    access_token, expires_in = create_access_token(user.id)
    set_refresh_cookie(response, raw_refresh_token)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=expires_in,
        user=UserResponse.model_validate(user),
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Rotate refresh token and issue new access token",
)
def refresh(
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    payload: RefreshRequest | None = None,
    cookie_token: Annotated[str | None, Cookie(alias=REFRESH_COOKIE_NAME)] = None,
    user_agent: Annotated[str | None, Header()] = None,
) -> TokenResponse:
    check_rate_limit(request, "auth_refresh")
    verify_csrf_and_origin(request)

    # Prefer HttpOnly cookie; allow payload as fallback
    raw_token = cookie_token or (payload.refresh_token if payload else None)
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    client_ip = request.client.host if request.client else None
    user, access_token, new_raw_token, expires_in = rotate_refresh_token(
        db=db,
        raw_token=raw_token,
        user_agent=user_agent,
        ip_address=client_ip,
    )

    set_refresh_cookie(response, new_raw_token)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=expires_in,
        user=UserResponse.model_validate(user),
    )


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Revoke current session and clear refresh cookie",
)
def logout(
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    payload: RefreshRequest | None = None,
    cookie_token: Annotated[str | None, Cookie(alias=REFRESH_COOKIE_NAME)] = None,
) -> MessageResponse:
    verify_csrf_and_origin(request)
    raw_token = cookie_token or (payload.refresh_token if payload else None)
    if raw_token:
        revoke_refresh_session(db=db, raw_token=raw_token)

    clear_refresh_cookie(response)
    return MessageResponse(detail="Successfully logged out.")


@router.post(
    "/logout-all",
    response_model=MessageResponse,
    summary="Revoke all active sessions for current user",
)
def logout_all(
    request: Request,
    response: Response,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> MessageResponse:
    verify_csrf_and_origin(request)
    revoke_all_user_sessions(db=db, user_id=current_user.id)
    clear_refresh_cookie(response)
    return MessageResponse(detail="All active sessions have been revoked.")
