import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  apiRequest,
  getAccessToken,
  setAccessToken,
  ApiRequestError,
  API_BASE_URL,
} from "../api/client";
import { loginApi, logoutApi, refreshApi, registerApi } from "../api/auth";

describe("Frontend In-Memory Token Management", () => {
  beforeEach(() => {
    setAccessToken(null);
  });

  it("stores access token strictly in memory and retrieves it", () => {
    expect(getAccessToken()).toBeNull();
    setAccessToken("test-access-token-123");
    expect(getAccessToken()).toBe("test-access-token-123");
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });

  it("does not write tokens to localStorage", () => {
    setAccessToken("secret-access-token");
    // Ensure localStorage does not contain any access token
    expect(window.localStorage.getItem("access_token")).toBeNull();
    expect(window.localStorage.getItem("token")).toBeNull();
    expect(window.localStorage.getItem("refresh_token")).toBeNull();
  });
});

describe("Frontend API Client and Session Handling", () => {
  beforeEach(() => {
    setAccessToken(null);
    vi.restoreAllMocks();
  });

  it("sends credentials: 'include' and attaches Bearer authorization header", async () => {
    setAccessToken("sample-jwt-token");

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "ok" }),
    });
    globalThis.fetch = mockFetch;

    const result = await apiRequest<{ status: string }>("/api/v1/health");
    expect(result).toEqual({ status: "ok" });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = mockFetch.mock.calls[0];
    expect(calledUrl).toBe(`${API_BASE_URL}/api/v1/health`);
    expect(calledInit.credentials).toBe("include");

    const headers = new Headers(calledInit.headers);
    expect(headers.get("Authorization")).toBe("Bearer sample-jwt-token");
  });

  it("handles 401 by attempting silent refresh and retrying request", async () => {
    setAccessToken("old-expired-token");

    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      callCount++;
      if (url.includes("/api/v1/auth/refresh")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            access_token: "new-rotated-token",
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
          }),
        });
      }

      if (callCount === 1) {
        // First attempt returns 401
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({ detail: "Token has expired" }),
        });
      }

      // Retry attempt succeeds
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ message: "Success after refresh" }),
      });
    });

    globalThis.fetch = mockFetch;

    const res = await apiRequest<{ message: string }>("/api/v1/users/me");
    expect(res).toEqual({ message: "Success after refresh" });
    expect(getAccessToken()).toBe("new-rotated-token");
  });

  it("clears in-memory token when refresh fails on 401", async () => {
    setAccessToken("invalid-token");

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/v1/auth/refresh")) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({ detail: "Refresh token expired" }),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 401,
        json: async () => ({ detail: "Token has expired" }),
      });
    });

    globalThis.fetch = mockFetch;

    await expect(apiRequest("/api/v1/users/me")).rejects.toThrow(ApiRequestError);
    expect(getAccessToken()).toBeNull();
  });
});

describe("Auth API Methods", () => {
  beforeEach(() => {
    setAccessToken(null);
    vi.restoreAllMocks();
  });

  it("loginApi saves returned access token in memory", async () => {
    const mockUser = {
      id: "u-123",
      email: "login@example.com",
      display_name: "User",
      is_active: true,
      is_verified: false,
      created_at: "2026-10-10T00:00:00Z",
      updated_at: "2026-10-10T00:00:00Z",
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "login-jwt-token",
        token_type: "bearer",
        expires_in: 900,
        user: mockUser,
      }),
    });

    const res = await loginApi({ email: "login@example.com", password: "Password123!" });
    expect(res.access_token).toBe("login-jwt-token");
    expect(getAccessToken()).toBe("login-jwt-token");
    expect(res.user.email).toBe("login@example.com");
  });

  it("logoutApi clears in-memory access token", async () => {
    setAccessToken("active-token");

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ detail: "Successfully logged out." }),
    });

    await logoutApi();
    expect(getAccessToken()).toBeNull();
  });

  it("registerApi invokes register endpoint with payload", async () => {
    const mockUser = {
      id: "u-456",
      email: "new@example.com",
      display_name: "New User",
      is_active: true,
      is_verified: false,
      created_at: "2026-10-10T00:00:00Z",
      updated_at: "2026-10-10T00:00:00Z",
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => mockUser,
    });

    const created = await registerApi({
      email: "new@example.com",
      display_name: "New User",
      password: "Password123!",
    });
    expect(created.id).toBe("u-456");
    expect(created.email).toBe("new@example.com");
  });

  it("refreshApi updates in-memory token on success", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "refreshed-jwt",
        token_type: "bearer",
        expires_in: 900,
        user: { id: "u-1" },
      }),
    });

    const res = await refreshApi();
    expect(res.access_token).toBe("refreshed-jwt");
    expect(getAccessToken()).toBe("refreshed-jwt");
  });
});
