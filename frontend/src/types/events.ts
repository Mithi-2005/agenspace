export type EventSource = "user" | "imported" | "suggested" | "confirmed";

/** Event as returned by the server API */
export interface KoswayEvent {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  location: string | null;
  source: EventSource;
  created_at: string;
  updated_at: string;
}

export interface EventCreate {
  title: string;
  description?: string | null;
  starts_at: string;
  ends_at: string;
  location?: string | null;
}

export interface EventUpdate {
  title?: string;
  description?: string | null;
  starts_at?: string;
  ends_at?: string;
  location?: string | null;
}

export interface EventListResponse {
  items: KoswayEvent[];
  total: number;
}
