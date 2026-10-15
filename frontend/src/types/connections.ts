export type ConnectionStatus =
  | "available"
  | "connecting"
  | "connected"
  | "attention"
  | "disconnected"
  | "not_implemented";

export type ConnectionProviderId = "gmail" | "google-calendar" | "outlook-calendar";

export interface ConnectionProvider {
  id: ConnectionProviderId;
  name: string;
  description: string;
  category: "mail" | "calendar";
  status: ConnectionStatus;
  enables: string[];
}

export interface ConnectionCatalog {
  providers: ConnectionProvider[];
  implementedCount: number;
}
