import threading
import time
from collections import defaultdict
from typing import Protocol

from fastapi import HTTPException, Request, status

from app.core.config import get_settings


class BaseRateLimiter(Protocol):
    """Protocol for pluggable rate limiting backends (in-memory, Redis, etc.)."""

    def is_rate_limited(
        self, key: str, max_requests: int, window_seconds: int
    ) -> tuple[bool, int, int]:
        """
        Check if key has exceeded max_requests in window_seconds.
        Returns: (is_limited, remaining_requests, retry_after_seconds)
        """
        ...


class InMemorySlidingWindowRateLimiter:
    """
    Thread-safe, sliding-window rate limiter stored in-process.

    NOTE: This is an in-memory implementation suitable for single-process deployments
    and local development. In multi-worker or horizontally scaled production clusters,
    this per-process limiter must be backed by a shared store such as Redis.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._requests: dict[str, list[float]] = defaultdict(list)

    def is_rate_limited(
        self, key: str, max_requests: int, window_seconds: int
    ) -> tuple[bool, int, int]:
        now = time.monotonic()
        cutoff = now - window_seconds

        with self._lock:
            # Filter timestamps outside the window
            timestamps = [t for t in self._requests[key] if t > cutoff]
            self._requests[key] = timestamps

            if len(timestamps) >= max_requests:
                earliest = timestamps[0]
                retry_after = max(1, int(window_seconds - (now - earliest)))
                return True, 0, retry_after

            # Record this request
            self._requests[key].append(now)
            remaining = max_requests - len(self._requests[key])
            return False, remaining, 0

    def reset(self) -> None:
        """Reset all rate limit tracking (useful for test isolation)."""
        with self._lock:
            self._requests.clear()


# Default singleton instance
rate_limiter = InMemorySlidingWindowRateLimiter()


def check_rate_limit(
    request: Request,
    key_prefix: str,
    max_requests: int | None = None,
    window_seconds: int | None = None,
) -> None:
    """
    Enforce rate limit for an incoming request.
    Raises HTTPException 429 if limit is exceeded.
    """
    settings = get_settings()
    if not settings.auth_rate_limit_enabled:
        return

    effective_max = max_requests or settings.auth_rate_limit_requests
    effective_window = window_seconds or settings.auth_rate_limit_window_seconds

    # Extract client IP
    client_ip = "127.0.0.1"
    if request.client and request.client.host:
        client_ip = request.client.host

    limit_key = f"{key_prefix}:{client_ip}"
    is_limited, _, retry_after = rate_limiter.is_rate_limited(
        key=limit_key,
        max_requests=effective_max,
        window_seconds=effective_window,
    )

    if is_limited:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )
