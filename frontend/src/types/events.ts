export type EventSource = "user" | "imported" | "suggested" | "confirmed";

/** Event as returned by the server API */
export interface AgenSpaceEvent {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  timezone: string | null;
  all_day: boolean;
  source: EventSource;
  created_at: string;
  updated_at: string;
}

export interface EventCreate {
  title: string;
  description?: string | null;
  starts_at: string;
  ends_at?: string | null;
  location?: string | null;
  timezone?: string | null;
  all_day?: boolean;
}

export interface EventUpdate {
  title?: string;
  description?: string | null;
  starts_at?: string;
  ends_at?: string | null;
  location?: string | null;
  timezone?: string | null;
  all_day?: boolean;
}

export interface EventListResponse {
  items: AgenSpaceEvent[];
  total: number;
}
