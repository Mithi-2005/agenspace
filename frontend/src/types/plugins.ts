export type PluginCategory =
  | "All"
  | "Productivity"
  | "Communication"
  | "Education"
  | "Development"
  | "Calendar";

export interface PluginPublisher {
  name: string;
  verified: boolean;
  support_url?: string | null;
}

export interface PluginPermission {
  scope: string;
  description: string;
  required: boolean;
}

export interface PluginLifecycle {
  listing: "available" | "hidden";
  installation: "installed" | "not_installed";
  connection: "unavailable" | "disconnected" | "connected";
  synchronization: "never" | "idle" | "syncing" | "synced" | "error";
  runtime_capabilities: "planned" | "ready" | "active";
}

export interface PluginListing {
  id: string;
  name: string;
  summary: string;
  description: string;
  category: string;
  icon: string;
  publisher: PluginPublisher;
  status: "planned" | "beta" | "available";
  integration_status: "planned" | "preview" | "available";
  capabilities: string[];
  permissions: PluginPermission[];
  setup_requirements: string;
  lifecycle: PluginLifecycle;
  is_installed: boolean;
  installed_at?: string | null;
  is_enabled?: boolean;
}

export interface PluginListResponse {
  items: PluginListing[];
  total: number;
  categories: string[];
}

export interface InstalledPluginResponse {
  id: string;
  plugin_id: string;
  is_enabled: boolean;
  installed_at: string;
}
