export interface GmailSyncResult {
  status: string;
  messages_synced: number;
  suggestions_created: number;
  extraction_failures: number;
  fetch_failures: number;
  last_synced_at: string | null;
}
