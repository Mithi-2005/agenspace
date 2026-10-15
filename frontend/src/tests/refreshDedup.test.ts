/**
 * Regression tests for refresh-token concurrency deduplication.
 *
 * Root cause fixed: AuthContext.restoreSession previously called refreshApi()
 * through a separate code path that could race with the 401-recovery path in
 * apiRequest(). Both paths now share requestTokenRefresh(), which uses an
 * activeRefreshPromise single-flight guard so that N concurrent callers in the
 * same browser context produce exactly one HTTP request to /auth/refresh.
 *
 * These tests prove:
 *  1. N concurrent calls to requestTokenRefresh() issue only one HTTP fetch.
 *  2. All concurrent callers receive the same resolved token response.
 *  3. All concurrent callers receive the same rejection on failure.
 *  4. The guard resets correctly so subsequent calls create a fresh request.
 *  5. Successful session restoration via refreshApi() stores the access token.
 *  6. Failed restoration via refreshApi() clears the access token.
 *  7. 401 → silent refresh → retry via apiRequest() works end-to-end.
 *  8. N concurrent failing API requests share one refresh call, not N.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  requestTokenRefresh,
  apiRequest,
  getAccessToken,
  setAccessToken,
  ApiRequestError,
} from "../api/client";
import { refreshApi } from "../api/auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_TOKEN_RESPONSE = {
  access_token: "new-access-token",
  token_type: "bearer",
  expires_in: 900,
  user: {
    id: "00000000-0000-0000-0000-000000000001",
    email: "test@example.com",
    display_name: "Test User",
    is_active: true,
    is_verified: false,
    created_at: "2026-10-10T00:00:00Z",
    updated_at: "2026-10-10T00:00:00Z",
  },
};

function makeSuccessfulRefreshFetch(fetchSpy: ReturnType<typeof vi.fn>) {
  fetchSpy.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => MOCK_TOKEN_RESPONSE,
  });
}

function makeFailingRefreshFetch(fetchSpy: ReturnType<typeof vi.fn>, status = 401) {
  fetchSpy.mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ detail: "Refresh token expired or revoked." }),
  });
}

// ---------------------------------------------------------------------------
// 1. Single-flight deduplication
// ---------------------------------------------------------------------------

describe("requestTokenRefresh — single-flight deduplication", () => {
  beforeEach(() => {
    setAccessToken(null);
    vi.restoreAllMocks();
  });

  it("issues exactly one HTTP request when called concurrently N times", async () => {
    const fetchSpy = vi.fn();
    makeSuccessfulRefreshFetch(fetchSpy);
    globalThis.fetch = fetchSpy;

    // Simulate N concurrent callers — analogous to restoreSession + 401-retry
    // both firing at the same instant.
    const CONCURRENT = 8;
    const results = await Promise.all(
      Array.from({ length: CONCURRENT }, () => requestTokenRefresh()),
    );

    // Only one network round-trip should have occurred.
    const refreshCalls = fetchSpy.mock.calls.filter((args) =>
      String(args[0]).includes("/auth/refresh"),
    );
    expect(refreshCalls).toHaveLength(1);

    // Every caller must receive the same token.
    for (const res of results) {
      expect(res.access_token).toBe(MOCK_TOKEN_RESPONSE.access_token);
    }
  });

  it("resolves all concurrent callers with the same TokenResponse object reference", async () => {
    const fetchSpy = vi.fn();
    makeSuccessfulRefreshFetch(fetchSpy);
    globalThis.fetch = fetchSpy;

    const [r1, r2, r3] = await Promise.all([
      requestTokenRefresh(),
      requestTokenRefresh(),
      requestTokenRefresh(),
    ]);

    expect(r1.access_token).toBe("new-access-token");
    expect(r2.access_token).toBe("new-access-token");
    expect(r3.access_token).toBe("new-access-token");
    // Same promise — same resolved reference
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
  });

  it("rejects all concurrent callers when refresh fails, with only one HTTP call", async () => {
    const fetchSpy = vi.fn();
    makeFailingRefreshFetch(fetchSpy, 401);
    globalThis.fetch = fetchSpy;

    const results = await Promise.allSettled([
      requestTokenRefresh(),
      requestTokenRefresh(),
      requestTokenRefresh(),
    ]);

    for (const res of results) {
      expect(res.status).toBe("rejected");
      if (res.status === "rejected") {
        expect(res.reason).toBeInstanceOf(ApiRequestError);
        expect((res.reason as ApiRequestError).status).toBe(401);
      }
    }

    // Still only one actual HTTP call.
    const refreshCalls = fetchSpy.mock.calls.filter((args) =>
      String(args[0]).includes("/auth/refresh"),
    );
    expect(refreshCalls).toHaveLength(1);
  });

  it("resets the guard after success so the next sequential call creates a fresh request", async () => {
    const fetchSpy = vi.fn();
    makeSuccessfulRefreshFetch(fetchSpy);
    globalThis.fetch = fetchSpy;

    await requestTokenRefresh();
    await requestTokenRefresh(); // guard must have reset

    const refreshCalls = fetchSpy.mock.calls.filter((args) =>
      String(args[0]).includes("/auth/refresh"),
    );
    expect(refreshCalls).toHaveLength(2);
  });

  it("resets the guard after rejection so the next sequential call creates a fresh request", async () => {
    const fetchSpy = vi.fn();
    makeFailingRefreshFetch(fetchSpy);
    globalThis.fetch = fetchSpy;

    await requestTokenRefresh().catch(() => undefined);
    await requestTokenRefresh().catch(() => undefined);

    const refreshCalls = fetchSpy.mock.calls.filter((args) =>
      String(args[0]).includes("/auth/refresh"),
    );
    expect(refreshCalls).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 2. Session restoration via refreshApi()
// ---------------------------------------------------------------------------

describe("refreshApi — session restoration", () => {
  beforeEach(() => {
    setAccessToken(null);
    vi.restoreAllMocks();
  });

  it("stores the returned access token in memory on success", async () => {
    const fetchSpy = vi.fn();
    makeSuccessfulRefreshFetch(fetchSpy);
    globalThis.fetch = fetchSpy;

    const res = await refreshApi();
    expect(res.access_token).toBe("new-access-token");
    expect(getAccessToken()).toBe("new-access-token");
  });

  it("clears the in-memory token and throws when refresh returns 401", async () => {
    setAccessToken("stale-token");
    const fetchSpy = vi.fn();
    makeFailingRefreshFetch(fetchSpy, 401);
    globalThis.fetch = fetchSpy;

    await expect(refreshApi()).rejects.toThrow(ApiRequestError);
    expect(getAccessToken()).toBeNull();
  });

  it("concurrent refreshApi() calls still produce exactly one HTTP request", async () => {
    const fetchSpy = vi.fn();
    makeSuccessfulRefreshFetch(fetchSpy);
    globalThis.fetch = fetchSpy;

    // This is the exact race that AuthContext.useEffect + 401-retry used to create
    const [r1, r2] = await Promise.all([refreshApi(), refreshApi()]);

    const refreshCalls = fetchSpy.mock.calls.filter((args) =>
      String(args[0]).includes("/auth/refresh"),
    );
    expect(refreshCalls).toHaveLength(1);
    expect(r1.access_token).toBe("new-access-token");
    expect(r2.access_token).toBe("new-access-token");
  });
});

// ---------------------------------------------------------------------------
// 3. 401-retry path via apiRequest()
// ---------------------------------------------------------------------------

describe("apiRequest — 401 recovery via shared requestTokenRefresh", () => {
  beforeEach(() => {
    setAccessToken(null);
    vi.restoreAllMocks();
  });

  it("refreshes once and retries on 401, returning the successful retry response", async () => {
    setAccessToken("expired-token");
    let apiCallIndex = 0;

    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/auth/refresh")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => MOCK_TOKEN_RESPONSE,
        });
      }
      apiCallIndex++;
      if (apiCallIndex === 1) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({ detail: "Token expired." }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ data: "protected-resource" }),
      });
    });
    globalThis.fetch = fetchSpy;

    const res = await apiRequest<{ data: string }>("/api/v1/protected");
    expect(res.data).toBe("protected-resource");
    expect(getAccessToken()).toBe("new-access-token");
  });

  it("propagates ApiRequestError when refresh fails during 401 recovery", async () => {
    setAccessToken("bad-token");

    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/auth/refresh")) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({ detail: "Refresh token expired or revoked." }),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 401,
        json: async () => ({ detail: "Token expired." }),
      });
    });
    globalThis.fetch = fetchSpy;

    await expect(apiRequest("/api/v1/protected")).rejects.toThrow(ApiRequestError);
    expect(getAccessToken()).toBeNull();
  });

  it("N concurrent failing API requests share one refresh call — not N", async () => {
    // This test is the key regression check for the bug.
    // Previously, restoreSession and 401-recovery could each fire a refresh
    // independently. Now all go through the same guard.
    setAccessToken("shared-expired-token");

    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/auth/refresh")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => MOCK_TOKEN_RESPONSE,
        });
      }
      // All API calls respond with 401 to trigger refresh
      return Promise.resolve({
        ok: false,
        status: 401,
        json: async () => ({ detail: "Token expired." }),
      });
    });
    globalThis.fetch = fetchSpy;

    await Promise.allSettled([
      apiRequest("/api/v1/a"),
      apiRequest("/api/v1/b"),
      apiRequest("/api/v1/c"),
      apiRequest("/api/v1/d"),
    ]);

    const refreshCalls = fetchSpy.mock.calls.filter((args) =>
      String(args[0]).includes("/auth/refresh"),
    );
    // Must be exactly 1, not 4
    expect(refreshCalls).toHaveLength(1);
  });
});
// ---------------------------------------------------------------------------
// 4. StrictMode isCancelled guard
// ---------------------------------------------------------------------------

describe("StrictMode isCancelled guard — no stale state after unmount", () => {
  beforeEach(() => {
    setAccessToken(null);
    vi.restoreAllMocks();
  });

  it("does not mutate state after isCancelled is set (simulates StrictMode teardown)", async () => {
    // Arrange: a deferred fetch that we can resolve after cancellation
    let resolveRefresh!: (v: unknown) => void;
    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/auth/refresh")) {
        return new Promise((resolve) => {
          resolveRefresh = resolve;
        });
      }
      return Promise.resolve({ ok: false, status: 401, json: async () => ({}) });
    });
    globalThis.fetch = fetchSpy;

    // Simulate what AuthContext.useEffect does
    let isCancelled = false;
    const stateUpdates: string[] = [];

    const restoreSession = async () => {
      const result = await refreshApi();
      if (!isCancelled) {
        stateUpdates.push("authenticated:" + result.access_token);
      }
      // If isCancelled, we intentionally skip the state update
    };

    const promise = restoreSession().catch(() => {
      if (!isCancelled) stateUpdates.push("unauthenticated");
    });

    // Simulate StrictMode: cleanup fires before the fetch resolves
    isCancelled = true;

    // Now the fetch resolves (token arrives after the component unmounted)
    resolveRefresh({
      ok: true,
      status: 200,
      json: async () => MOCK_TOKEN_RESPONSE,
    });

    await promise;

    // State must NOT have been updated because isCancelled was true
    expect(stateUpdates).toHaveLength(0);

    // The access token in memory IS updated (requestTokenRefresh side-effect),
    // but React state was not touched — which is the correct behaviour.
    expect(getAccessToken()).toBe("new-access-token");
  });

  it("does not mutate state on failed refresh after isCancelled is set", async () => {
    let resolveRefresh!: (v: unknown) => void;
    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/auth/refresh")) {
        return new Promise((resolve) => {
          resolveRefresh = resolve;
        });
      }
      return Promise.resolve({ ok: false, status: 401, json: async () => ({}) });
    });
    globalThis.fetch = fetchSpy;

    let isCancelled = false;
    const stateUpdates: string[] = [];

    const restoreSession = async () => {
      await refreshApi();
      if (!isCancelled) stateUpdates.push("authenticated");
    };

    const promise = restoreSession().catch(() => {
      if (!isCancelled) stateUpdates.push("unauthenticated");
    });

    isCancelled = true;

    // Resolve with failure
    resolveRefresh({
      ok: false,
      status: 401,
      json: async () => ({ detail: "Refresh token revoked." }),
    });

    await promise;

    // Neither branch of state update should have run
    expect(stateUpdates).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. 401 concurrent with restoreSession — shared promise
// ---------------------------------------------------------------------------

describe("401 concurrent with restoreSession — single shared refresh promise", () => {
  beforeEach(() => {
    setAccessToken(null);
    vi.restoreAllMocks();
  });

  it("a 401 triggered while restoreSession is in-flight joins the same promise, not a new one", async () => {
    // This is the original real-world race condition:
    // 1. App mounts, useEffect fires refreshApi() [restoreSession].
    // 2. Another API call (dashboard data) fires simultaneously and gets a 401.
    // 3. The 401 handler calls requestTokenRefresh().
    //
    // Expected: both share the same in-flight promise — ONE network call.

    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/auth/refresh")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => MOCK_TOKEN_RESPONSE,
        });
      }
      // The API call that causes the 401
      return Promise.resolve({
        ok: false,
        status: 401,
        json: async () => ({ detail: "Token expired." }),
      });
    });
    globalThis.fetch = fetchSpy;

    // Fire both concurrently: restoreSession path and 401-recovery path
    const [restoreResult, apiResult] = await Promise.allSettled([
      refreshApi(),                                    // restoreSession path
      apiRequest("/api/v1/dashboard"),                 // fires 401 → requestTokenRefresh
    ]);

    const refreshCalls = fetchSpy.mock.calls.filter((args) =>
      String(args[0]).includes("/auth/refresh"),
    );

    // Only ONE refresh HTTP call should have happened
    expect(refreshCalls).toHaveLength(1);

    // restoreSession should have the token
    expect(restoreResult.status).toBe("fulfilled");
    if (restoreResult.status === "fulfilled") {
      expect(restoreResult.value.access_token).toBe("new-access-token");
    }

    // apiRequest will fail because the retry still gets 401 (mocked), but that
    // is expected behaviour — the refresh itself was deduplicated.
    expect(apiResult.status).toBe("rejected");
  });

  it("restoreSession concurrent with N api 401s still produces one refresh call", async () => {
    setAccessToken("old-token");

    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/auth/refresh")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => MOCK_TOKEN_RESPONSE,
        });
      }
      return Promise.resolve({
        ok: false,
        status: 401,
        json: async () => ({ detail: "Token expired." }),
      });
    });
    globalThis.fetch = fetchSpy;

    await Promise.allSettled([
      refreshApi(),                        // restoreSession
      apiRequest("/api/v1/tasks"),         // 401 → refresh
      apiRequest("/api/v1/events"),        // 401 → refresh (should share)
      apiRequest("/api/v1/dashboard"),     // 401 → refresh (should share)
    ]);

    const refreshCalls = fetchSpy.mock.calls.filter((args) =>
      String(args[0]).includes("/auth/refresh"),
    );
    expect(refreshCalls).toHaveLength(1);
  });
});
