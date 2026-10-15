import type { KoswayEvent } from "../types/events";

export interface EventQueryResult {
  events: KoswayEvent[];
  available: boolean;
  reason?: string;
}

export async function listUpcomingEvents(): Promise<EventQueryResult> {
  return {
    events: [],
    available: false,
    reason: "not-implemented",
  };
}
