import { apiRequest } from "../../api/client";
import type {
  InstalledPluginResponse,
  PluginListing,
  PluginListResponse,
} from "./types";

export async function fetchPlugins(params?: {
  category?: string;
  search?: string;
  installed_only?: boolean;
}): Promise<PluginListResponse> {
  const query = new URLSearchParams();
  if (params?.category && params.category !== "All") {
    query.set("category", params.category);
  }
  if (params?.search) {
    query.set("search", params.search);
  }
  if (params?.installed_only) {
    query.set("installed_only", "true");
  }

  const qs = query.toString();
  const endpoint = `/api/v1/plugins${qs ? `?${qs}` : ""}`;
  return apiRequest<PluginListResponse>(endpoint);
}

export async function fetchPlugin(pluginId: string): Promise<PluginListing> {
  return apiRequest<PluginListing>(`/api/v1/plugins/${encodeURIComponent(pluginId)}`);
}

export async function installPlugin(pluginId: string): Promise<InstalledPluginResponse> {
  return apiRequest<InstalledPluginResponse>(
    `/api/v1/plugins/${encodeURIComponent(pluginId)}/install`,
    {
      method: "POST",
    },
  );
}

export async function uninstallPlugin(
  pluginId: string,
): Promise<{ status: string; plugin_id: string }> {
  return apiRequest<{ status: string; plugin_id: string }>(
    `/api/v1/plugins/${encodeURIComponent(pluginId)}`,
    {
      method: "DELETE",
    },
  );
}

export async function togglePlugin(
  pluginId: string,
  isEnabled: boolean,
): Promise<InstalledPluginResponse> {
  return apiRequest<InstalledPluginResponse>(
    `/api/v1/plugins/${encodeURIComponent(pluginId)}/toggle?is_enabled=${isEnabled}`,
    {
      method: "PATCH",
    },
  );
}
