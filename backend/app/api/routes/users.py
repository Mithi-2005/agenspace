from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.user import PasswordChangeRequest, UserResponse, UserUpdateRequest
from app.services.user_service import change_user_password, update_user_profile

router = APIRouter()


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current authenticated user profile",
)
def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.patch(
    "/me",
    response_model=UserResponse,
    summary="Update current authenticated user profile",
)
def update_me(
    payload: UserUpdateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> UserResponse:
    updated_user = update_user_profile(
        db=db,
        user=current_user,
        display_name=payload.display_name,
        timezone=payload.timezone,
    )
    return UserResponse.model_validate(updated_user)


@router.post(
    "/me/password",
    response_model=MessageResponse,
    summary="Change password and revoke active sessions",
)
def update_password(
    payload: PasswordChangeRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> MessageResponse:
    change_user_password(
        db=db,
        user=current_user,
        current_password=payload.current_password,
        new_password=payload.new_password,
    )
    return MessageResponse(
        detail="Password updated successfully. Active sessions have been revoked."
    )
