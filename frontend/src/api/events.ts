import { apiRequest } from "./client";
import type { AgenSpaceEvent, EventCreate, EventListResponse, EventUpdate } from "../types/events";

export async function createEventApi(payload: EventCreate): Promise<AgenSpaceEvent> {
  return apiRequest<AgenSpaceEvent>("/api/v1/events", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listEventsApi(params?: {
  starts_after?: string;
  starts_before?: string;
  limit?: number;
  offset?: number;
}): Promise<EventListResponse> {
  const query = new URLSearchParams();
  if (params?.starts_after) query.set("starts_after", params.starts_after);
  if (params?.starts_before) query.set("starts_before", params.starts_before);
  if (params?.limit != null) query.set("limit", String(params.limit));
  if (params?.offset != null) query.set("offset", String(params.offset));
  const qs = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<EventListResponse>(`/api/v1/events${qs}`);
}

export async function getEventApi(id: string): Promise<AgenSpaceEvent> {
  return apiRequest<AgenSpaceEvent>(`/api/v1/events/${id}`);
}

export async function updateEventApi(id: string, payload: EventUpdate): Promise<AgenSpaceEvent> {
  return apiRequest<AgenSpaceEvent>(`/api/v1/events/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteEventApi(id: string): Promise<void> {
  await apiRequest<void>(`/api/v1/events/${id}`, { method: "DELETE" });
}
