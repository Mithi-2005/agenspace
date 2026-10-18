import { apiRequest } from "../../api/client";
import type { GoogleConnectionStatus } from "./types";

export async function getGoogleStatusApi(): Promise<GoogleConnectionStatus> {
  return apiRequest<GoogleConnectionStatus>("/api/v1/integrations/google/status");
}

export async function getGoogleAuthorizeUrlApi(): Promise<{ authorization_url: string }> {
  return apiRequest<{ authorization_url: string }>("/api/v1/integrations/google/authorize");
}

export async function disconnectGoogleApi(): Promise<{ status: string }> {
  return apiRequest<{ status: string }>("/api/v1/integrations/google/disconnect", {
    method: "DELETE",
  });
}
