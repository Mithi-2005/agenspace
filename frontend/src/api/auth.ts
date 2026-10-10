import { apiRequest, setAccessToken } from "./client";
import type { MessageResponse, TokenResponse, User } from "../types/auth";

export async function registerApi(payload: {
  email: string;
  password: string;
  display_name: string;
}): Promise<User> {
  return apiRequest<User>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginApi(payload: {
  email: string;
  password: string;
}): Promise<TokenResponse> {
  const data = await apiRequest<TokenResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  setAccessToken(data.access_token);
  return data;
}

export async function refreshApi(): Promise<TokenResponse> {
  const data = await apiRequest<TokenResponse>("/api/v1/auth/refresh", {
    method: "POST",
  });
  setAccessToken(data.access_token);
  return data;
}

export async function logoutApi(): Promise<MessageResponse> {
  try {
    return await apiRequest<MessageResponse>("/api/v1/auth/logout", {
      method: "POST",
    });
  } finally {
    setAccessToken(null);
  }
}

export async function logoutAllApi(): Promise<MessageResponse> {
  try {
    return await apiRequest<MessageResponse>("/api/v1/auth/logout-all", {
      method: "POST",
    });
  } finally {
    setAccessToken(null);
  }
}
