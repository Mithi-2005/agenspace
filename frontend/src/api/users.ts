import { apiRequest } from "./client";
import type { MessageResponse, User } from "../types/auth";

export async function getMeApi(): Promise<User> {
  return apiRequest<User>("/api/v1/users/me", {
    method: "GET",
  });
}

export async function updateMeApi(payload: {
  display_name: string;
}): Promise<User> {
  return apiRequest<User>("/api/v1/users/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function changePasswordApi(payload: {
  current_password: string;
  new_password: string;
}): Promise<MessageResponse> {
  return apiRequest<MessageResponse>("/api/v1/users/me/password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
