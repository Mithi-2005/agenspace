from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.plugin import InstalledPlugin
from app.plugins.catalog import CATEGORIES, PLUGIN_CATALOG
from app.schemas.plugin import (
    PluginLifecycle,
    PluginListing,
    PluginPermission,
    PluginPublisher,
)


def _build_listing(raw: dict[str, Any], installed: InstalledPlugin | None) -> PluginListing:
    is_installed = installed is not None
    return PluginListing(
        id=raw["id"],
        name=raw["name"],
        summary=raw["summary"],
        description=raw["description"],
        category=raw["category"],
        icon=raw["icon"],
        publisher=PluginPublisher(**raw["publisher"]),
        status=raw["status"],
        integration_status=raw["integration_status"],
        capabilities=raw["capabilities"],
        permissions=[PluginPermission(**p) for p in raw["permissions"]],
        setup_requirements=raw["setup_requirements"],
        lifecycle=PluginLifecycle(
            listing="available",
            installation="installed" if is_installed else "not_installed",
            connection="unavailable",
            synchronization="never",
            runtime_capabilities="planned",
        ),
        is_installed=is_installed,
        installed_at=installed.installed_at if installed else None,
        is_enabled=installed.is_enabled if installed else False,
    )


def list_plugins(
    db: Session,
    user_id: uuid.UUID,
    category: str | None = None,
    search: str | None = None,
    installed_only: bool = False,
) -> tuple[list[PluginListing], int, list[str]]:
    # Load user's installed plugins map
    stmt = select(InstalledPlugin).where(InstalledPlugin.user_id == user_id)
    user_installs = {row.plugin_id: row for row in db.scalars(stmt).all()}

    results: list[PluginListing] = []
    search_term = search.strip().lower() if search else None
    cat_filter = category.strip().lower() if category and category.lower() != "all" else None

    for raw in PLUGIN_CATALOG:
        pid = raw["id"]
        installed_record = user_installs.get(pid)

        if installed_only and not installed_record:
            continue

        if cat_filter and raw["category"].lower() != cat_filter:
            continue

        if search_term:
            in_name = search_term in raw["name"].lower()
            in_summary = search_term in raw["summary"].lower()
            in_desc = search_term in raw["description"].lower()
            in_cat = search_term in raw["category"].lower()
            if not (in_name or in_summary or in_desc or in_cat):
                continue

        results.append(_build_listing(raw, installed_record))

    return results, len(results), CATEGORIES


def get_plugin(
    db: Session,
    user_id: uuid.UUID,
    plugin_id: str,
) -> PluginListing | None:
    raw = next((p for p in PLUGIN_CATALOG if p["id"] == plugin_id), None)
    if not raw:
        return None

    stmt = select(InstalledPlugin).where(
        InstalledPlugin.user_id == user_id,
        InstalledPlugin.plugin_id == plugin_id,
    )
    installed_record = db.scalar(stmt)
    return _build_listing(raw, installed_record)


def install_plugin(
    db: Session,
    user_id: uuid.UUID,
    plugin_id: str,
) -> InstalledPlugin:
    raw = next((p for p in PLUGIN_CATALOG if p["id"] == plugin_id), None)
    if not raw:
        raise ValueError(f"Unknown plugin identifier: {plugin_id}")

    stmt = select(InstalledPlugin).where(
        InstalledPlugin.user_id == user_id,
        InstalledPlugin.plugin_id == plugin_id,
    )
    existing = db.scalar(stmt)
    if existing:
        return existing

    record = InstalledPlugin(
        user_id=user_id,
        plugin_id=plugin_id,
        is_enabled=True,
        installed_at=datetime.now(UTC),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def uninstall_plugin(
    db: Session,
    user_id: uuid.UUID,
    plugin_id: str,
) -> bool:
    stmt = select(InstalledPlugin).where(
        InstalledPlugin.user_id == user_id,
        InstalledPlugin.plugin_id == plugin_id,
    )
    existing = db.scalar(stmt)
    if not existing:
        return False

    db.delete(existing)
    db.commit()
    return True


def toggle_plugin(
    db: Session,
    user_id: uuid.UUID,
    plugin_id: str,
    is_enabled: bool,
) -> InstalledPlugin | None:
    stmt = select(InstalledPlugin).where(
        InstalledPlugin.user_id == user_id,
        InstalledPlugin.plugin_id == plugin_id,
    )
    existing = db.scalar(stmt)
    if not existing:
        return None

    existing.is_enabled = is_enabled
    existing.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(existing)
    return existing
