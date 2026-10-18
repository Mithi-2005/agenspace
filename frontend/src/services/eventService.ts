import type { AgenSpaceEvent } from "../types/events";

export interface EventQueryResult {
  events: AgenSpaceEvent[];
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
