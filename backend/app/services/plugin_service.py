from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.plugin import InstalledPlugin
from app.schemas.plugin import (
    PluginLifecycle,
    PluginListing,
    PluginPermission,
    PluginPublisher,
)

CATEGORIES: list[str] = [
    "Productivity",
    "Communication",
    "Education",
    "Development",
    "Calendar",
]

PLUGIN_CATALOG: list[dict[str, Any]] = [
    {
        "id": "gmail",
        "name": "Gmail",
        "summary": "Official email intelligence and action-item ingestion from your Gmail inbox.",
        "description": (
            "Connect your Google Mail account to enable Moon to review unread notifications, "
            "surface pending follow-ups, synthesize email threads, and draft contextual replies. "
            "All OAuth access is restricted to verified Google scopes with strictly scoped read "
            "and compose privileges."
        ),
        "category": "Communication",
        "icon": "mail",
        "publisher": {
            "name": "Google LLC",
            "verified": True,
            "support_url": "https://workspace.google.com",
        },
        "status": "planned",
        "integration_status": "planned",
        "capabilities": [
            "Automated inbox message triage",
            "Action item and deadline extraction",
            "Smart draft follow-up generation",
            "Thread summary digests for Moon assistant",
        ],
        "permissions": [
            {
                "scope": "https://www.googleapis.com/auth/gmail.readonly",
                "description": "Read email messages and headers to detect follow-ups",
                "required": True,
            },
            {
                "scope": "https://www.googleapis.com/auth/gmail.compose",
                "description": "Create draft responses for your explicit confirmation",
                "required": False,
            },
        ],
        "setup_requirements": "Google OAuth 2.0 with offline access token. Requires explicit user consent.",
    },
    {
        "id": "google-classroom",
        "name": "Google Classroom",
        "summary": "Coursework, assignment deadlines, and syllabus tracking from Google Classroom.",
        "description": (
            "Sync active courses, upcoming coursework due dates, teacher announcements, and submission "
            "states directly into Kosway tasks and calendar agenda. Keeps students ahead of coursework "
            "deadlines without manual data entry."
        ),
        "category": "Education",
        "icon": "graduation-cap",
        "publisher": {
            "name": "Google LLC",
            "verified": True,
            "support_url": "https://classroom.google.com",
        },
        "status": "planned",
        "integration_status": "planned",
        "capabilities": [
            "Course roster and syllabus ingestion",
            "Assignment due date tracking & automatic task creation",
            "Teacher announcements digest",
            "Submission status verification",
        ],
        "permissions": [
            {
                "scope": "https://www.googleapis.com/auth/classroom.courses.readonly",
                "description": "View your Google Classroom courses",
                "required": True,
            },
            {
                "scope": "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
                "description": "View coursework and assignment deadlines",
                "required": True,
            },
            {
                "scope": "https://www.googleapis.com/auth/classroom.announcements.readonly",
                "description": "Read course announcements for important updates",
                "required": False,
            },
        ],
        "setup_requirements": "Student or Educator Google Account with Classroom API permissions enabled.",
    },
    {
        "id": "google-calendar",
        "name": "Google Calendar",
        "summary": "Two-way calendar agenda synchronization and event scheduling intelligence.",
        "description": (
            "Seamlessly mirror commitments from Google Calendar into Kosway's daily agenda and "
            "spatial overview. Enables Moon to detect scheduling conflicts, suggest focus blocks, "
            "and notify you before high-priority meetings."
        ),
        "category": "Calendar",
        "icon": "calendar",
        "publisher": {
            "name": "Google LLC",
            "verified": True,
            "support_url": "https://calendar.google.com",
        },
        "status": "planned",
        "integration_status": "planned",
        "capabilities": [
            "Two-way calendar schedule synchronization",
            "Meeting overlap and conflict warning",
            "Smart focus-time allocation suggestions",
            "Meeting participant agenda briefing",
        ],
        "permissions": [
            {
                "scope": "https://www.googleapis.com/auth/calendar.readonly",
                "description": "Read upcoming events, reminders, and attendee lists",
                "required": True,
            },
            {
                "scope": "https://www.googleapis.com/auth/calendar.events",
                "description": "Add and reschedule confirmed events upon your approval",
                "required": False,
            },
        ],
        "setup_requirements": "Google OAuth 2.0 calendar scope consent. Preserves private event metadata.",
    },
    {
        "id": "github",
        "name": "GitHub",
        "summary": "Pull requests, review requests, issue assignments, and repository activity feeds.",
        "description": (
            "Connect GitHub to bring engineering workflows into your personal dashboard. "
            "Automatically surface assigned issues, pending review requests on PRs, CI workflow "
            "statuses, and milestone deadlines across your personal and organization repositories."
        ),
        "category": "Development",
        "icon": "github",
        "publisher": {
            "name": "GitHub, Inc.",
            "verified": True,
            "support_url": "https://github.com",
        },
        "status": "planned",
        "integration_status": "planned",
        "capabilities": [
            "Pull request review request notifications",
            "Assigned issue tracking and triage",
            "CI/CD failure alert aggregation",
            "Repository commit digest for weekly standups",
        ],
        "permissions": [
            {
                "scope": "read:user",
                "description": "Read profile information to associate author handles",
                "required": True,
            },
            {
                "scope": "repo:status",
                "description": "Access commit statuses and pull request checks",
                "required": True,
            },
            {
                "scope": "notifications",
                "description": "Ingest GitHub notification streams into task inbox",
                "required": True,
            },
        ],
        "setup_requirements": "GitHub App or OAuth authorization with repository access delegation.",
    },
    {
        "id": "university-portal",
        "name": "University Portal",
        "summary": "Higher-education LMS, academic calendar, exam timetables, and campus feeds.",
        "description": (
            "Standardized connector for student information systems (Canvas, Blackboard, Moodle, "
            "and campus portal iCal feeds). Integrates academic deadlines, lecture schedules, term "
            "exam timetables, and campus notifications directly into your student planner."
        ),
        "category": "Education",
        "icon": "school",
        "publisher": {
            "name": "Kosway Academic Consortium",
            "verified": True,
            "support_url": "https://kosway.app/education",
        },
        "status": "planned",
        "integration_status": "planned",
        "capabilities": [
            "Canvas / Blackboard / Moodle assignment ingestion",
            "Term exam timetable and lecture schedule sync",
            "Campus announcements and deadline alerts",
            "Automated study block scheduling for exams",
        ],
        "permissions": [
            {
                "scope": "lms:read_calendar",
                "description": "Read institutional calendar feeds and course timetable",
                "required": True,
            },
            {
                "scope": "lms:read_assignments",
                "description": "Access assignment due dates and rubric updates",
                "required": True,
            },
        ],
        "setup_requirements": "Campus LMS Personal Access Token or institution iCal subscription URL.",
    },
    {
        "id": "notion",
        "name": "Notion",
        "summary": "Sync workspace databases, task lists, and meeting notes with Kosway.",
        "description": (
            "Integrate Notion pages and databases with Kosway tasks. Seamlessly link sprint backlogs, "
            "personal wikis, and project documentation directly to your daily focus workflows."
        ),
        "category": "Productivity",
        "icon": "file-text",
        "publisher": {
            "name": "Notion Labs, Inc.",
            "verified": True,
            "support_url": "https://notion.so",
        },
        "status": "planned",
        "integration_status": "planned",
        "capabilities": [
            "Database page task synchronization",
            "Project documentation bidirectional links",
            "Daily meeting notes template generation",
        ],
        "permissions": [
            {
                "scope": "pages:read",
                "description": "Read database entries and workspace pages",
                "required": True,
            },
            {
                "scope": "pages:write",
                "description": "Create action item sub-pages on demand",
                "required": False,
            },
        ],
        "setup_requirements": "Notion Internal Integration Token or OAuth 2.0 workspace access.",
    },
]


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
