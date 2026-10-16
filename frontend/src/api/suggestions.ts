import { apiRequest } from "./client";
import type { Suggestion } from "../types/suggestions";

export async function listSuggestionsApi(): Promise<Suggestion[]> {
  return apiRequest<Suggestion[]>("/api/v1/suggestions");
}

export async function acceptSuggestionApi(suggestionId: string): Promise<{
  status: string;
  suggestion_id: string;
  created_type: string;
  item_id: string;
  title: string;
}> {
  return apiRequest(`/api/v1/suggestions/${suggestionId}/accept`, {
    method: "POST",
  });
}

export async function dismissSuggestionApi(suggestionId: string): Promise<{
  status: string;
  suggestion_id: string;
}> {
  return apiRequest(`/api/v1/suggestions/${suggestionId}/dismiss`, {
    method: "POST",
  });
}
