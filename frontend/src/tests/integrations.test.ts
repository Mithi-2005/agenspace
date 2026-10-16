import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  disconnectGoogleApi,
  getGoogleAuthorizeUrlApi,
  getGoogleStatusApi,
  triggerGoogleSyncApi,
} from "../api/integrations";
import {
  acceptSuggestionApi,
  dismissSuggestionApi,
  listSuggestionsApi,
} from "../api/suggestions";

describe("integrations API client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getGoogleStatusApi parses connected state correctly", async () => {
    const mockStatus = {
      provider: "google",
      is_connected: true,
      email: "user@gmail.com",
      status: "active",
      last_synced_at: "2026-10-15T12:00:00Z",
      last_sync_status: "success",
      last_error_message: null,
    };

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => mockStatus,
    });

    const result = await getGoogleStatusApi();
    expect(result.is_connected).toBe(true);
    expect(result.email).toBe("user@gmail.com");
    expect(result.last_sync_status).toBe("success");
  });

  it("getGoogleAuthorizeUrlApi returns authorization url", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ authorization_url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=123" }),
    });

    const result = await getGoogleAuthorizeUrlApi();
    expect(result.authorization_url).toContain("https://accounts.google.com");
  });

  it("triggerGoogleSyncApi reports sync count and suggestions created", async () => {
    const mockSyncRes = {
      status: "success",
      messages_synced: 5,
      suggestions_created: 2,
      last_synced_at: "2026-10-15T12:05:00Z",
    };

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => mockSyncRes,
    });

    const result = await triggerGoogleSyncApi();
    expect(result.status).toBe("success");
    expect(result.messages_synced).toBe(5);
    expect(result.suggestions_created).toBe(2);
  });

  it("disconnectGoogleApi sends DELETE request", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ status: "disconnected" }),
    });

    const result = await disconnectGoogleApi();
    expect(result.status).toBe("disconnected");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/integrations/google/disconnect"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

describe("suggestions API client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("listSuggestionsApi returns list of suggestions", async () => {
    const mockSuggestions = [
      {
        id: "sug-1",
        suggestion_type: "task",
        title: "Complete lab report",
        description: "Due next Tuesday",
        suggested_date: "2026-10-20T17:00:00Z",
        suggested_end_date: null,
        source_email_from: "instructor@univ.edu",
        source_email_subject: "Lab 3 instructions",
        confidence: "high",
        reasons: "Explicit deadline detected",
        status: "pending",
        created_at: "2026-10-15T10:00:00Z",
      },
    ];

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => mockSuggestions,
    });

    const list = await listSuggestionsApi();
    expect(list.length).toBe(1);
    expect(list[0].title).toBe("Complete lab report");
    expect(list[0].suggestion_type).toBe("task");
  });

  it("acceptSuggestionApi posts to accept endpoint", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        status: "accepted",
        suggestion_id: "sug-1",
        created_type: "task",
        item_id: "task-99",
        title: "Complete lab report",
      }),
    });

    const result = await acceptSuggestionApi("sug-1");
    expect(result.status).toBe("accepted");
    expect(result.item_id).toBe("task-99");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/suggestions/sug-1/accept"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("dismissSuggestionApi posts to dismiss endpoint", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        status: "dismissed",
        suggestion_id: "sug-2",
      }),
    });

    const result = await dismissSuggestionApi("sug-2");
    expect(result.status).toBe("dismissed");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/suggestions/sug-2/dismiss"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});
