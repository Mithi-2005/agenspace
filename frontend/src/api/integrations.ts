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

export async function disconnectGoogleApi(): Promise<{ status: string }> {
  return apiRequest<{ status: string }>("/api/v1/integrations/google/disconnect", {
    method: "DELETE",
  });
}
