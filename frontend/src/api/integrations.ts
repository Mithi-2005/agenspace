import { apiRequest } from "./client";
import type { GoogleConnectionStatus, GoogleSyncResult } from "../types/integrations";

export async function getGoogleStatusApi(): Promise<GoogleConnectionStatus> {
  return apiRequest<GoogleConnectionStatus>("/api/v1/integrations/google/status");
}

export async function getGoogleAuthorizeUrlApi(): Promise<{ authorization_url: string }> {
  return apiRequest<{ authorization_url: string }>("/api/v1/integrations/google/authorize");
}

export async function triggerGoogleSyncApi(): Promise<GoogleSyncResult> {
  return apiRequest<GoogleSyncResult>("/api/v1/integrations/google/sync", {
    method: "POST",
  });
}

export async function retryGoogleFailuresApi(): Promise<GoogleSyncResult> {
  return apiRequest<GoogleSyncResult>("/api/v1/integrations/google/retry-failed", {
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

export async function disconnectGoogleApi(): Promise<{ status: string }> {
  return apiRequest<{ status: string }>("/api/v1/integrations/google/disconnect", {
    method: "DELETE",
  });
}
