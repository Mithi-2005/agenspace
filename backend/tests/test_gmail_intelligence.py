import base64
import json
from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

import httpx
import pytest
from pydantic import SecretStr

from app.core.config import Settings
from app.integrations.google.sync import _gmail_body_text
from app.services.gmail_intelligence_service import (
    GmailIntelligenceError,
    GmailIntelligenceService,
    _retry_after,
)


def _settings() -> Settings:
    return Settings(
        database_url="sqlite://",
        AI_PROVIDER="xai",
        XAI_API_KEY=SecretStr("test-key"),
        XAI_MODEL="grok-test",
    )


def _gemini_settings() -> Settings:
    return Settings(
        database_url="sqlite://",
        AI_PROVIDER="gemini",
        GEMINI_API_KEY=SecretStr("test-gemini-key"),
        GEMINI_MODEL="gemini-test-model",
    )


def _response(suggestions: list[dict]) -> MagicMock:
    result = MagicMock()
    result.status_code = 200
    result.json.return_value = {
        "choices": [{"message": {"content": json.dumps({"suggestions": suggestions})}}]
    }
    result.headers = {}
    return result


def test_unactionable_email_returns_empty_list(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.gmail_intelligence_service.get_settings", _settings)
    with patch("httpx.Client.post", return_value=_response([])):
        result = GmailIntelligenceService().extract(
            subject="Monthly update",
            sender="news@example.com",
            recipient="user@example.com",
            body="Here is our monthly newsletter.",
            sent_at=datetime(2026, 10, 17, 9, tzinfo=UTC),
            timezone="Asia/Kolkata",
        )
    assert result.suggestions == []


def test_clear_task_is_returned_with_supported_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.gmail_intelligence_service.get_settings", _settings)
    output = [
        {
            "type": "task",
            "title": "Submit the revised proposal",
            "description": "Send the revised proposal to the client.",
            "priority": "high",
            "due_at": "2026-10-20T17:00:00+05:30",
            "starts_at": None,
            "ends_at": None,
            "timezone": "Asia/Kolkata",
            "location": None,
            "confidence": 0.96,
            "evidence": "Please send the revised proposal by Tuesday at 5 PM.",
        }
    ]
    with patch("httpx.Client.post", return_value=_response(output)):
        result = GmailIntelligenceService().extract(
            subject="Proposal revision",
            sender="client@example.com",
            recipient="user@example.com",
            body="Please send the revised proposal by Tuesday at 5 PM.",
            sent_at=datetime(2026, 10, 17, 8, tzinfo=UTC),
            timezone="Asia/Kolkata",
        )
    task = result.suggestions[0]
    assert task.type == "task"
    assert task.title == "Submit the revised proposal"
    assert task.priority == "high"
    assert task.due_at is not None and task.due_at.hour == 17
    assert task.confidence == 0.96


def test_multiple_actions_and_ambiguous_deadline_are_preserved(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.services.gmail_intelligence_service.get_settings", _settings)
    output = [
        {
            "type": "task",
            "title": "Review the contract",
            "description": "Review and comment.",
            "priority": "medium",
            "due_at": None,
            "starts_at": None,
            "ends_at": None,
            "timezone": None,
            "location": None,
            "confidence": 0.65,
            "evidence": "Please review the contract soon.",
        },
        {
            "type": "task",
            "title": "Return the signed copy",
            "description": "Send the signed copy.",
            "priority": None,
            "due_at": None,
            "starts_at": None,
            "ends_at": None,
            "timezone": None,
            "location": None,
            "confidence": 0.87,
            "evidence": "Return the signed copy after review.",
        },
    ]
    with patch("httpx.Client.post", return_value=_response(output)):
        result = GmailIntelligenceService().extract(
            subject="Contract",
            sender="legal@example.com",
            recipient=None,
            body="Please review the contract soon and return the signed copy after review.",
            sent_at=datetime(2026, 10, 17, 8, tzinfo=UTC),
            timezone="UTC",
        )
    assert len(result.suggestions) == 2
    assert all(item.due_at is None for item in result.suggestions)


def test_unconfigured_blank_key_is_explicit_and_does_not_call_provider(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = Settings(
        database_url="sqlite://", AI_PROVIDER="gemini", GEMINI_API_KEY=SecretStr(" ")
    )
    monkeypatch.setattr("app.services.gmail_intelligence_service.get_settings", lambda: settings)
    with patch("httpx.Client.post") as post, pytest.raises(GmailIntelligenceError) as exc:
        GmailIntelligenceService().extract(
            subject="x",
            sender="x",
            recipient=None,
            body="x",
            sent_at=datetime(2026, 10, 17, tzinfo=UTC),
            timezone=None,
        )
    assert exc.value.retryable is False
    assert "not configured" in str(exc.value)
    post.assert_not_called()


def test_gemini_provider_uses_configured_model_and_schema(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.gmail_intelligence_service.get_settings", _gemini_settings)
    response = MagicMock(status_code=200, headers={})
    response.json.return_value = {
        "candidates": [
            {"content": {"parts": [{"text": '{"suggestions": []}'}]}, "finishReason": "STOP"}
        ]
    }
    with patch("httpx.Client.post", return_value=response) as post:
        result = GmailIntelligenceService().extract(
            subject="Update", sender="team@example.com", recipient=None, body="FYI",
            sent_at=datetime(2026, 10, 17, 9, tzinfo=UTC), timezone="Asia/Kolkata",
        )
    assert result.suggestions == []
    args = post.call_args
    assert args.args[0] == (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        "gemini-test-model:generateContent"
    )
    assert args.kwargs["headers"] == {"x-goog-api-key": "test-gemini-key"}
    request = args.kwargs["json"]
    assert request["contents"][0]["role"] == "user"
    assert '"user_timezone": "Asia/Kolkata"' in request["contents"][0]["parts"][0]["text"]
    assert request["generationConfig"]["responseMimeType"] == "application/json"
    schema = request["generationConfig"]["responseSchema"]
    assert schema["type"] == "object"
    suggestion_schema = schema["properties"]["suggestions"]["items"]
    assert suggestion_schema["properties"]["due_at"] == {
        "type": "string",
        "format": "date-time",
        "nullable": True,
    }
    assert "$ref" not in json.dumps(schema)
    assert "anyOf" not in json.dumps(schema)
    assert "test-gemini-key" not in args.args[0]


def test_gemini_http_400_is_non_retryable_and_logs_sanitized_error(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setattr("app.services.gmail_intelligence_service.get_settings", _gemini_settings)
    response = MagicMock(status_code=400, headers={})
    response.json.return_value = {
        "error": {
            "code": 400,
            "status": "INVALID_ARGUMENT",
            "message": "Invalid input: private email body; key=test-gemini-key",
        }
    }
    with (
        patch("httpx.Client.post", return_value=response) as post,
        pytest.raises(GmailIntelligenceError) as exc,
    ):
        GmailIntelligenceService().extract(
            subject="x",
            sender="x",
            recipient=None,
            body="private email body",
            sent_at=datetime(2026, 10, 17, tzinfo=UTC),
            timezone=None,
        )
    assert exc.value.retryable is False
    assert post.call_count == 1
    assert "HTTP 400" in caplog.text
    assert "INVALID_ARGUMENT" in caplog.text
    assert "private email body" not in caplog.text
    assert "test-gemini-key" not in caplog.text


def test_gemini_http_429_retries_then_succeeds(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = _gemini_settings()
    settings.ai_max_retries = 1
    monkeypatch.setattr("app.services.gmail_intelligence_service.get_settings", lambda: settings)
    limited = MagicMock(status_code=429, headers={"Retry-After": "0"})
    limited.json.return_value = {"error": {"code": 429, "status": "RESOURCE_EXHAUSTED"}}
    success = MagicMock(status_code=200, headers={})
    success.json.return_value = {
        "candidates": [{"content": {"parts": [{"text": '{"suggestions": []}'}]}}]
    }
    with (
        patch("httpx.Client.post", side_effect=[limited, success]) as post,
        patch("app.services.gmail_intelligence_service.time.sleep"),
    ):
        result = GmailIntelligenceService().extract(
            subject="x",
            sender="x",
            recipient=None,
            body="x",
            sent_at=datetime(2026, 10, 17, tzinfo=UTC),
            timezone=None,
        )
    assert result.suggestions == []
    assert post.call_count == 2


@pytest.mark.parametrize(
    "payload",
    [
        {"candidates": []},
        {"candidates": [{"content": {"parts": [{"text": "not json"}]}}]},
        {"candidates": [{"content": {"parts": [{"text": ""}]}}]},
        {"candidates": [{"finishReason": "SAFETY", "content": {"parts": []}}]},
    ],
    ids=["empty-response", "malformed-json", "empty-text", "safety-block"],
)
def test_gemini_malformed_or_empty_output_is_non_retryable(
    monkeypatch: pytest.MonkeyPatch, payload: dict
) -> None:
    monkeypatch.setattr("app.services.gmail_intelligence_service.get_settings", _gemini_settings)
    response = MagicMock(status_code=200, headers={})
    response.json.return_value = payload
    with (
        patch("httpx.Client.post", return_value=response) as post,
        pytest.raises(GmailIntelligenceError) as exc,
    ):
        GmailIntelligenceService().extract(
            subject="x",
            sender="x",
            recipient=None,
            body="x",
            sent_at=datetime(2026, 10, 17, tzinfo=UTC),
            timezone=None,
        )
    assert exc.value.retryable is False
    assert post.call_count == 1


def test_ai_model_override_takes_precedence() -> None:
    settings = Settings(
        database_url="sqlite://", AI_PROVIDER="gemini", AI_MODEL="custom-gemini-model"
    )
    assert settings.active_ai_model == "custom-gemini-model"


def test_retry_after_accepts_http_date() -> None:
    from email.utils import format_datetime

    deadline = datetime.now(UTC).replace(microsecond=0)
    assert 0 <= _retry_after(format_datetime(deadline)) <= 1


def test_three_pm_event_retains_user_timezone(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.gmail_intelligence_service.get_settings", _settings)
    output = [
        {
            "type": "event",
            "title": "Project review",
            "description": "Discuss the draft.",
            "priority": None,
            "due_at": None,
            "starts_at": "2026-10-18T15:00:00+05:30",
            "ends_at": None,
            "timezone": "Asia/Kolkata",
            "location": None,
            "confidence": 0.91,
            "evidence": "tomorrow at 3 PM",
        }
    ]
    with patch("httpx.Client.post", return_value=_response(output)) as post:
        result = GmailIntelligenceService().extract(
            subject="Review",
            sender="lead@example.com",
            recipient=None,
            body="Let's meet tomorrow at 3 PM.",
            sent_at=datetime(2026, 10, 17, 8, tzinfo=UTC),
            timezone="Asia/Kolkata",
        )
    start = result.suggestions[0].starts_at
    assert start is not None
    assert start.hour == 15 and start.minute == 0
    assert start.utcoffset().total_seconds() == 19800
    assert start.astimezone(UTC).isoformat() == "2026-10-18T09:30:00+00:00"
    sent = post.call_args.kwargs["json"]["messages"][1]["content"]
    assert '"user_timezone": "Asia/Kolkata"' in sent


def test_naive_event_time_uses_user_timezone_and_crosses_midnight_correctly(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.services.gmail_intelligence_service.get_settings", _settings)
    output = [
        {
            "type": "event",
            "title": "Early check-in",
            "starts_at": "2026-10-18T00:15:00",
            "timezone": None,
            "confidence": 0.9,
            "evidence": "At 12:15 AM",
        }
    ]
    with patch("httpx.Client.post", return_value=_response(output)):
        result = GmailIntelligenceService().extract(
            subject="Early meeting",
            sender="team@example.com",
            recipient=None,
            body="Meet at 12:15 AM.",
            sent_at=datetime(2026, 10, 17, 8, tzinfo=UTC),
            timezone="Asia/Kolkata",
        )
    start = result.suggestions[0].starts_at
    assert start is not None
    assert start.isoformat() == "2026-10-18T00:15:00+05:30"
    assert start.astimezone(UTC).isoformat() == "2026-10-17T18:45:00+00:00"
    assert result.suggestions[0].timezone == "Asia/Kolkata"


def test_all_day_event_is_normalized_to_local_midnight_bounds(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.services.gmail_intelligence_service.get_settings", _settings)
    output = [
        {
            "type": "event",
            "title": "Public holiday",
            "starts_at": "2026-10-18T09:00:00+05:30",
            "timezone": "Asia/Kolkata",
            "all_day": True,
            "confidence": 0.9,
            "evidence": "The office is closed on October 18.",
        }
    ]
    with patch("httpx.Client.post", return_value=_response(output)):
        result = GmailIntelligenceService().extract(
            subject="Holiday", sender="hr@example.com", recipient=None, body="Office closed",
            sent_at=datetime(2026, 10, 17, 8, tzinfo=UTC), timezone="Asia/Kolkata",
        )
    event = result.suggestions[0]
    assert event.all_day is True
    assert event.starts_at is not None and event.starts_at.isoformat() == "2026-10-18T00:00:00+05:30"
    assert event.ends_at is not None and event.ends_at.isoformat() == "2026-10-19T00:00:00+05:30"


def test_multipart_prefers_plain_text_and_html_fallback() -> None:
    plain = base64.urlsafe_b64encode(b"Plain body").decode().rstrip("=")
    html_body = (
        base64.urlsafe_b64encode(b"<p>HTML <b>body</b></p><script>ignore()</script>")
        .decode()
        .rstrip("=")
    )
    payload = {
        "mimeType": "multipart/alternative",
        "parts": [
            {"mimeType": "text/html", "body": {"data": html_body}},
            {"mimeType": "text/plain", "body": {"data": plain}},
        ],
    }
    assert _gmail_body_text(payload) == "Plain body"
    assert _gmail_body_text({"mimeType": "text/html", "body": {"data": html_body}}) == "HTML body"


def test_authentication_failure_is_not_retried(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.gmail_intelligence_service.get_settings", _settings)
    response = MagicMock(status_code=401, headers={})
    with (
        patch("httpx.Client.post", return_value=response) as post,
        pytest.raises(GmailIntelligenceError) as exc,
    ):
        GmailIntelligenceService().extract(
            subject="x",
            sender="x",
            recipient=None,
            body="x",
            sent_at=datetime(2026, 10, 17, tzinfo=UTC),
            timezone=None,
        )
    assert exc.value.retryable is False
    assert post.call_count == 1


def test_gemini_authentication_failure_is_not_retried(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.services.gmail_intelligence_service.get_settings", _gemini_settings)
    response = MagicMock(status_code=403, headers={})
    with (
        patch("httpx.Client.post", return_value=response) as post,
        pytest.raises(GmailIntelligenceError) as exc,
    ):
        GmailIntelligenceService().extract(
            subject="x",
            sender="x",
            recipient=None,
            body="x",
            sent_at=datetime(2026, 10, 17, tzinfo=UTC),
            timezone=None,
        )
    assert exc.value.retryable is False
    assert post.call_count == 1


def test_malformed_model_output_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.gmail_intelligence_service.get_settings", _settings)
    response = MagicMock(status_code=200, headers={})
    response.json.return_value = {"choices": [{"message": {"content": "not json"}}]}
    with (
        patch("httpx.Client.post", return_value=response),
        pytest.raises(GmailIntelligenceError) as exc,
    ):
        GmailIntelligenceService().extract(
            subject="x",
            sender="x",
            recipient=None,
            body="x",
            sent_at=datetime(2026, 10, 17, tzinfo=UTC),
            timezone=None,
        )
    assert exc.value.retryable is False


def test_timeout_retries_are_bounded(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.gmail_intelligence_service.get_settings", _settings)
    with (
        patch("httpx.Client.post", side_effect=httpx.TimeoutException("timeout")) as post,
        patch("app.services.gmail_intelligence_service.time.sleep"),
        pytest.raises(GmailIntelligenceError) as exc,
    ):
        GmailIntelligenceService().extract(
            subject="x",
            sender="x",
            recipient=None,
            body="x",
            sent_at=datetime(2026, 10, 17, tzinfo=UTC),
            timezone=None,
        )
    assert exc.value.retryable is True
    assert post.call_count == 3


def test_retry_after_rate_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = _settings()
    settings.xai_max_retries = 1
    monkeypatch.setattr("app.services.gmail_intelligence_service.get_settings", lambda: settings)
    limited = MagicMock(status_code=429, headers={"Retry-After": "0"})
    with (
        patch("httpx.Client.post", side_effect=[limited, _response([])]) as post,
        patch("app.services.gmail_intelligence_service.time.sleep"),
    ):
        result = GmailIntelligenceService().extract(
            subject="x",
            sender="x",
            recipient=None,
            body="x",
            sent_at=datetime(2026, 10, 17, tzinfo=UTC),
            timezone=None,
        )
    assert result.suggestions == []
    assert post.call_count == 2
