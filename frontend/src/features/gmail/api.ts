import { apiRequest } from "../../api/client";
import type { GmailSyncResult } from "./types";

export async function triggerGmailSyncApi(): Promise<GmailSyncResult> {
  return apiRequest<GmailSyncResult>("/api/v1/integrations/google/sync", {
    method: "POST",
  });
}

export async function retryGmailFailuresApi(): Promise<GmailSyncResult> {
  return apiRequest<GmailSyncResult>("/api/v1/integrations/google/retry-failed", {
    method: "POST",
  });
}

export async function sendGmailMessageApi(payload: {
  to: string;
  subject: string;
  body: string;
  confirmed: true;
}): Promise<{ status: string }> {
  return apiRequest("/api/v1/integrations/google/messages/send", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function archiveGmailMessageApi(messageId: string): Promise<{ status: string }> {
  return apiRequest(`/api/v1/integrations/google/messages/${encodeURIComponent(messageId)}/archive`, {
    method: "POST",
    body: JSON.stringify({ message_id_confirmation: messageId }),
  });
}

export async function trashGmailMessageApi(messageId: string): Promise<{ status: string }> {
  return apiRequest(`/api/v1/integrations/google/messages/${encodeURIComponent(messageId)}/trash`, {
    method: "POST",
    body: JSON.stringify({ message_id_confirmation: messageId }),
  });
}

export async function permanentlyDeleteGmailMessageApi(
  messageId: string,
  confirmationPhrase: string,
): Promise<{ status: string }> {
  return apiRequest(
    `/api/v1/integrations/google/messages/${encodeURIComponent(messageId)}/permanently`,
    { method: "DELETE", body: JSON.stringify({ confirmation_phrase: confirmationPhrase }) },
  );
}
