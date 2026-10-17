export interface GoogleConnectionStatus {
  provider: "google";
  is_connected: boolean;
  email: string | null;
  status: string | null;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_error_message: string | null;
  reauthorization_required: boolean;
}

export interface GoogleSyncResult {
  status: string;
  messages_synced: number;
  suggestions_created: number;
  extraction_failures: number;
  fetch_failures: number;
  last_synced_at: string | null;
}
