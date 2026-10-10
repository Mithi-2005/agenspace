import type { TokenResponse } from "../types/auth";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

let inMemoryAccessToken: string | null = null;
let isRefreshing = false;
let refreshSubscribers: ((token: string | null) => void)[] = [];

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

function onRefreshed(token: string | null): void {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb: (token: string | null) => void): void {
  refreshSubscribers.push(cb);
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
    // If this request is the initiator of the refresh
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshResponse = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        });

        if (refreshResponse.ok) {
          const data = (await refreshResponse.json()) as TokenResponse;
          setAccessToken(data.access_token);
          isRefreshing = false;
          onRefreshed(data.access_token);

          // Retry the initiator request
          headers.set("Authorization", `Bearer ${data.access_token}`);
          const retryRes = await fetch(url, { ...options, headers, credentials: "include" });
          if (!retryRes.ok) {
            const errorData = await retryRes.json().catch(() => ({}));
            const detail = errorData.detail || "Request failed";
            throw new ApiRequestError(
              retryRes.status,
              typeof detail === "string" ? detail : JSON.stringify(detail),
            );
          }
          return (await retryRes.json()) as T;
        } else {
          setAccessToken(null);
          isRefreshing = false;
          onRefreshed(null);
          throw new ApiRequestError(401, "Session expired. Please log in again.");
        }
      } catch (err) {
        setAccessToken(null);
        isRefreshing = false;
        onRefreshed(null);
        throw err;
      }
    }

    // Concurrent requests that arrived while refresh was already pending
    return new Promise((resolve, reject) => {
      addRefreshSubscriber((newToken) => {
        if (!newToken) {
          reject(new ApiRequestError(401, "Session expired. Please log in again."));
          return;
        }
        headers.set("Authorization", `Bearer ${newToken}`);
        fetch(url, { ...options, headers, credentials: "include" })
          .then(async (retryRes) => {
            if (!retryRes.ok) {
              const errorData = await retryRes.json().catch(() => ({}));
              const detail = errorData.detail || "Request failed";
              reject(
                new ApiRequestError(
                  retryRes.status,
                  typeof detail === "string" ? detail : JSON.stringify(detail),
                ),
              );
            } else {
              resolve((await retryRes.json()) as T);
            }
          })
          .catch(reject);
      });
    });
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
