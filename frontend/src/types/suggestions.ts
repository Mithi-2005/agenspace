export type SuggestionKind = "task" | "event";
export type SuggestionSource = "gmail" | "calendar";

export interface DetectedSuggestion {
  id: string;
  kind: SuggestionKind;
  title: string;
  dueAt: string | null;
  source: SuggestionSource;
  excerpt: string;
}

export type SuggestionAvailabilityReason = "not-implemented";

export interface SuggestionQueryResult {
  items: DetectedSuggestion[];
  available: false;
  reason: SuggestionAvailabilityReason;
}
