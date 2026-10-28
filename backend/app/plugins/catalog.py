from typing import Any

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
        "summary": "Sync Gmail and review detected tasks or events before adding them to your workspace.",
        "description": (
            "Connect Gmail to find possible tasks and events in your messages. Review each suggestion "
            "before adding it to your workspace. You can also send, archive, move to trash, or "
            "permanently delete messages with explicit confirmation."
        ),
        "category": "Communication",
        "icon": "mail",
        "publisher": {
            "name": "Google LLC",
            "verified": True,
            "support_url": "https://workspace.google.com",
        },
        "status": "available",
        "integration_status": "available",
        "runtime_capabilities": "active",
        "capabilities": [
            "Detect possible tasks in email",
            "Detect possible event details in email",
            "Review, accept, or dismiss extracted suggestions",
            "Send, archive, or remove messages with confirmation",
        ],
        "permissions": [
            {
                "scope": "https://mail.google.com/",
                "description": "Read and manage Gmail messages, including sending, archiving, and deletion",
                "required": True,
            },
        ],
        "setup_requirements": "Connect through Google OAuth and review the requested Gmail access. Sending and destructive message actions each require confirmation.",
    },
    {
        "id": "google-classroom",
        "name": "Google Classroom",
        "summary": "Coursework, assignment deadlines, and syllabus tracking from Google Classroom.",
        "description": (
            "Sync active courses, upcoming coursework due dates, teacher announcements, and submission "
            "states directly into AgenSpace tasks and calendar agenda. Keeps students ahead of coursework "
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
            "Seamlessly mirror commitments from Google Calendar into AgenSpace's daily agenda and "
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
            "name": "AgenSpace Academic Consortium",
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
        "summary": "Sync workspace databases, task lists, and meeting notes with AgenSpace.",
        "description": (
            "Integrate Notion pages and databases with AgenSpace tasks. Seamlessly link sprint backlogs, "
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
