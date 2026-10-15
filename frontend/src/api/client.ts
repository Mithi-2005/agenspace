import type { TokenResponse } from "../types/auth";

export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (typeof window !== "undefined") {
    // Keep host consistent with browser to prevent cross-site cookie restrictions
    if (envUrl) {
      if (window.location.hostname === "localhost" && envUrl.includes("127.0.0.1")) {
        return envUrl.replace("127.0.0.1", "localhost");
      }
      if (window.location.hostname === "127.0.0.1" && envUrl.includes("localhost")) {
        return envUrl.replace("localhost", "127.0.0.1");
      }
      return envUrl;
    }
    return window.location.hostname === "localhost"
      ? "http://localhost:8000"
      : "http://127.0.0.1:8000";
  }
  return envUrl || "http://127.0.0.1:8000";
}

export const API_BASE_URL = getApiBaseUrl();

let inMemoryAccessToken: string | null = null;
let activeRefreshPromise: Promise<TokenResponse> | null = null;

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail);
    this.name = "ApiRequestError";
  }
}

/**
 * Deduplicated, single-flight token refresh handler.
 * If a refresh is already in-flight, returns the pending promise.
 */
export async function requestTokenRefresh(): Promise<TokenResponse> {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    try {
      const refreshResponse = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!refreshResponse.ok) {
        const errorData = await refreshResponse.json().catch(() => ({}));
        let detail = "Session expired. Please log in again.";
        if (typeof errorData.detail === "string") {
          detail = errorData.detail;
        } else if (Array.isArray(errorData.detail)) {
          detail = errorData.detail
            .map((d: { msg?: string }) => d.msg || "")
            .filter(Boolean)
            .join(" ");
        }
        setAccessToken(null);
        throw new ApiRequestError(refreshResponse.status, detail);
      }

      const data = (await refreshResponse.json()) as TokenResponse;
      setAccessToken(data.access_token);
      return data;
    } catch (err) {
      if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403)) {
        setAccessToken(null);
      }
      throw err;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (inMemoryAccessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${inMemoryAccessToken}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  if (
    response.status === 401 &&
    !endpoint.includes("/auth/login") &&
    !endpoint.includes("/auth/refresh")
  ) {
    // Single-flight refresh token rotation and retry
    const refreshed = await requestTokenRefresh();
    headers.set("Authorization", `Bearer ${refreshed.access_token}`);
    const retryRes = await fetch(url, { ...options, headers, credentials: "include" });

    if (!retryRes.ok) {
      const errorData = await retryRes.json().catch(() => ({}));
      let detail = "Request failed";
      if (typeof errorData.detail === "string") {
        detail = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        detail = errorData.detail
          .map((d: { msg?: string }) => d.msg || "")
          .filter(Boolean)
          .join(" ");
      }
      throw new ApiRequestError(retryRes.status, detail);
    }

    return (await retryRes.json()) as T;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    let detail = "An unexpected error occurred.";
    if (typeof errorData.detail === "string") {
      detail = errorData.detail;
    } else if (Array.isArray(errorData.detail)) {
      detail = errorData.detail.map((d: { msg?: string }) => d.msg || "").filter(Boolean).join(" ");
    }
    throw new ApiRequestError(response.status, detail);
  }

  return response.json() as Promise<T>;
}
