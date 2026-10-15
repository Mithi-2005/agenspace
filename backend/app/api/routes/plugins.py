from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.plugin import (
    InstalledPluginResponse,
    PluginListing,
    PluginListResponse,
)
from app.services.plugin_service import (
    get_plugin,
    install_plugin,
    list_plugins,
    toggle_plugin,
    uninstall_plugin,
)

router = APIRouter()


@router.get(
    "",
    response_model=PluginListResponse,
    summary="List available plugins and their per-user installation state",
)
def list_all(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    category: Annotated[str | None, Query()] = None,
    search: Annotated[str | None, Query()] = None,
    installed_only: Annotated[bool, Query()] = False,
) -> PluginListResponse:
    items, total, categories = list_plugins(
        db=db,
        user_id=current_user.id,
        category=category,
        search=search,
        installed_only=installed_only,
    )
    return PluginListResponse(
        items=items,
        total=total,
        categories=categories,
    )


@router.get(
    "/{plugin_id}",
    response_model=PluginListing,
    summary="Retrieve details for a single plugin listing",
)
def get_one(
    plugin_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> PluginListing:
    plugin = get_plugin(db=db, user_id=current_user.id, plugin_id=plugin_id)
    if not plugin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plugin '{plugin_id}' not found.",
        )
    return plugin


@router.post(
    "/{plugin_id}/install",
    response_model=InstalledPluginResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Install a plugin into the current user's workspace",
)
def install(
    plugin_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> InstalledPluginResponse:
    try:
        record = install_plugin(db=db, user_id=current_user.id, plugin_id=plugin_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    return InstalledPluginResponse.model_validate(record)


@router.delete(
    "/{plugin_id}",
    summary="Uninstall a plugin from the current user's workspace",
)
def uninstall(
    plugin_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, str]:
    success = uninstall_plugin(db=db, user_id=current_user.id, plugin_id=plugin_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plugin '{plugin_id}' is not installed.",
        )
    return {"status": "uninstalled", "plugin_id": plugin_id}


@router.patch(
    "/{plugin_id}/toggle",
    response_model=InstalledPluginResponse,
    summary="Enable or disable an installed plugin",
)
def toggle(
    plugin_id: str,
    is_enabled: Annotated[bool, Query()],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> InstalledPluginResponse:
    record = toggle_plugin(
        db=db, user_id=current_user.id, plugin_id=plugin_id, is_enabled=is_enabled
    )
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plugin '{plugin_id}' is not installed.",
        )
    return InstalledPluginResponse.model_validate(record)
