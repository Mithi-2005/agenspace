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
  available: boolean;
  reason?: SuggestionAvailabilityReason;
}

export interface Suggestion {
  id: string;
  source_message_id: string | null;
  source_snippet: string | null;
  suggestion_type: "task" | "event";
  title: string;
  description: string | null;
  suggested_date: string | null;
  suggested_end_date: string | null;
  priority: string | null;
  timezone: string | null;
  all_day: boolean;
  location: string | null;
  source_email_from: string;
  source_email_subject: string;
  confidence: string;
  reasons: string | null;
  status: "pending" | "accepted" | "dismissed";
  created_at: string;
}
