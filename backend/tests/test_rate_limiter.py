from fastapi.testclient import TestClient

from app.core.rate_limiter import InMemorySlidingWindowRateLimiter


def test_in_memory_sliding_window_limiter() -> None:
    limiter = InMemorySlidingWindowRateLimiter()
    key = "test-client"

    # Limit = 3 requests per 10 seconds
    limited, rem, _ = limiter.is_rate_limited(key, max_requests=3, window_seconds=10)
    assert limited is False
    assert rem == 2

    limited, rem, _ = limiter.is_rate_limited(key, max_requests=3, window_seconds=10)
    assert limited is False
    assert rem == 1

    limited, rem, _ = limiter.is_rate_limited(key, max_requests=3, window_seconds=10)
    assert limited is False
    assert rem == 0

    # 4th request exceeds limit
    limited, rem, retry_after = limiter.is_rate_limited(key, max_requests=3, window_seconds=10)
    assert limited is True
    assert rem == 0
    assert retry_after > 0


def test_endpoint_rate_limit_enforced(client: TestClient) -> None:
    # Rapid registration attempts to exceed default threshold
    for i in range(10):
        client.post(
            "/api/v1/auth/register",
            json={
                "email": f"ratelimit{i}@example.com",
                "display_name": f"User {i}",
                "password": "Password123!",
            },
        )

    # 11th request should be rate-limited with 429
    blocked_response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "ratelimit_blocked@example.com",
            "display_name": "Blocked User",
            "password": "Password123!",
        },
    )
    assert blocked_response.status_code == 429
    assert "Too many attempts" in blocked_response.json()["detail"]
    assert "Retry-After" in blocked_response.headers
