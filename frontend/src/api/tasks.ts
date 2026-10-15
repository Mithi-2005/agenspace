import { apiRequest } from "./client";
import type { Task, TaskCreate, TaskListResponse, TaskStatus, TaskUpdate } from "../types/tasks";

export async function createTaskApi(payload: TaskCreate): Promise<Task> {
  return apiRequest<Task>("/api/v1/tasks", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listTasksApi(params?: {
  status?: TaskStatus;
  limit?: number;
  offset?: number;
}): Promise<TaskListResponse> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.limit != null) query.set("limit", String(params.limit));
  if (params?.offset != null) query.set("offset", String(params.offset));
  const qs = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<TaskListResponse>(`/api/v1/tasks${qs}`);
}

export async function getTaskApi(id: string): Promise<Task> {
  return apiRequest<Task>(`/api/v1/tasks/${id}`);
}

export async function updateTaskApi(id: string, payload: TaskUpdate): Promise<Task> {
  return apiRequest<Task>(`/api/v1/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function completeTaskApi(id: string): Promise<Task> {
  return apiRequest<Task>(`/api/v1/tasks/${id}/complete`, { method: "POST" });
}

export async function reopenTaskApi(id: string): Promise<Task> {
  return apiRequest<Task>(`/api/v1/tasks/${id}/reopen`, { method: "POST" });
}

export async function deleteTaskApi(id: string): Promise<void> {
  await apiRequest<void>(`/api/v1/tasks/${id}`, { method: "DELETE" });
}
