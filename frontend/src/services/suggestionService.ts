import type { SuggestionQueryResult } from "../types/suggestions";

export async function listDetectedSuggestions(): Promise<SuggestionQueryResult> {
  return {
    items: [],
    available: false,
    reason: "not-implemented",
  };
}
