import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Mail,
  RefreshCw,
  Unplug,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import {
  disconnectGoogleApi,
  getGoogleAuthorizeUrlApi,
  getGoogleStatusApi,
  triggerGoogleSyncApi,
} from "../api/integrations";
import { formatDateTime } from "../lib/format";
import { getConnectionCatalog } from "../services/connectionService";
import type { ConnectionProvider } from "../types/connections";
import type { GoogleConnectionStatus } from "../types/integrations";

function ProviderMark({ provider }: { provider: ConnectionProvider }) {
  const Icon = provider.category === "mail" ? Mail : CalendarDays;
  return (
    <span className={`provider-mark cat-${provider.category}`} aria-hidden="true">
      <Icon size={18} strokeWidth={1.75} />
    </span>
  );
}

export const ConnectionsPage: React.FC = () => {
  const catalog = getConnectionCatalog();
  const [googleStatus, setGoogleStatus] = useState<GoogleConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchStatus = React.useCallback(async () => {
    try {
      const status = await getGoogleStatusApi();
      setGoogleStatus(status);
    } catch {
      // Offline or network error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();

    // Check URL parameters for OAuth callback result
    const hash = window.location.hash;
    if (hash.includes("?")) {
      const queryStr = hash.split("?")[1];
      const params = new URLSearchParams(queryStr);
      const callbackStatus = params.get("status");
      const detail = params.get("detail");

      if (callbackStatus === "connected") {
        setMessage({
          type: "success",
          text: "Google account successfully connected! Gmail messages are ready to synchronize.",
        });
      } else if (callbackStatus === "error") {
        const errorText =
          detail === "account_conflict"
            ? "Account conflict: The connected Google account does not match your existing connection or is linked to another user."
            : detail === "invalid_or_expired_state"
              ? "OAuth authorization expired or was replayed. Please try connecting again."
              : detail === "access_denied"
                ? "Authorization was cancelled or denied in Google."
                : "Failed to connect Google account. Please verify configuration and try again.";
        setMessage({ type: "error", text: errorText });
      }

      // Clean up hash query without navigating
      window.history.replaceState(null, "", window.location.pathname + "#/connections");
    }
  }, [fetchStatus]);

  const handleConnectGoogle = async () => {
    try {
      setIsLoading(true);
      setMessage(null);
      const { authorization_url } = await getGoogleAuthorizeUrlApi();
      window.location.href = authorization_url;
    } catch (err) {
      setIsLoading(false);
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to initiate Google authorization.",
      });
    }
  };

  const handleSyncGoogle = async () => {
    try {
      setIsSyncing(true);
      setMessage(null);
      const res = await triggerGoogleSyncApi();
      await fetchStatus();
      setMessage({
        type: "success",
        text: `Synchronized ${res.messages_synced} messages. Created ${res.suggestions_created} new suggestions.`,
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to synchronize Gmail.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!window.confirm("Are you sure you want to disconnect Gmail? Confirmed tasks and events will be preserved, but unaccepted suggestions will be removed.")) {
      return;
    }

    try {
      setIsDisconnecting(true);
      setMessage(null);
      await disconnectGoogleApi();
      await fetchStatus();
      setMessage({
        type: "success",
        text: "Google account successfully disconnected.",
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to disconnect Google account.",
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="page-connections">
      <header className="page-kicker">
        <div>
          <p className="date-line">Authorized services</p>
          <h1>Connections</h1>
        </div>
      </header>

      {message && (
        <div
          className={`panel ${message.type === "error" ? "trust-panel meta-overdue" : "panel-primary"}`}
          style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}
          role="status"
        >
          {message.type === "error" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <p style={{ margin: 0 }}>{message.text}</p>
        </div>
      )}

      <section className="panel trust-panel">
        <h2>How connections work in Kosway</h2>
        <ul>
          <li>You authorize an external provider securely using OAuth 2.0 with minimal read-only scopes.</li>
          <li>Imported suggestions stay in Needs review on your dashboard until you accept or dismiss them.</li>
          <li>Disconnecting a provider revokes integration access while preserving all of your confirmed tasks and events.</li>
        </ul>
      </section>

      <ul className="provider-list">
        {/* Gmail provider card */}
        <li className="provider-row">
          <span className="provider-mark cat-mail" aria-hidden="true">
            <Mail size={18} strokeWidth={1.75} />
          </span>
          <div className="provider-body">
            <div className="provider-title">
              <h2>Gmail</h2>
              {isLoading ? (
                <span className="status-tag">Loading…</span>
              ) : googleStatus?.is_connected ? (
                <span className="status-tag status-installed" style={{ color: "var(--color-primary-dark)" }}>
                  Connected
                </span>
              ) : (
                <span className="status-tag">Available</span>
              )}
            </div>
            <p>
              Connect Gmail to automatically detect action items, assignment deadlines, and scheduled meetings for your review.
            </p>

            {googleStatus?.is_connected ? (
              <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <p className="meta-text" style={{ fontSize: "0.85rem" }}>
                  <strong>Account:</strong> {googleStatus.email ?? "Connected user"}
                  {googleStatus.last_synced_at && (
                    <> · <strong>Last synced:</strong> {formatDateTime(googleStatus.last_synced_at)}</>
                  )}
                  {googleStatus.last_sync_status && (
                    <> · <strong>Status:</strong> {googleStatus.last_sync_status}</>
                  )}
                </p>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
                  <button
                    type="button"
                    className="btn btn-lime btn-sm"
                    onClick={() => void handleSyncGoogle()}
                    disabled={isSyncing || isDisconnecting}
                  >
                    <RefreshCw size={13} className={isSyncing ? "animate-spin" : ""} />
                    {isSyncing ? "Syncing…" : "Sync Now"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => void handleDisconnectGoogle()}
                    disabled={isSyncing || isDisconnecting}
                  >
                    <Unplug size={13} />
                    {isDisconnecting ? "Disconnecting…" : "Disconnect"}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: "12px" }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => void handleConnectGoogle()}
                  disabled={isLoading}
                >
                  <ExternalLink size={13} />
                  Connect with Google
                </button>
              </div>
            )}
          </div>
        </li>

        {/* Other planned connection catalog items */}
        {catalog.providers
          .filter((p) => p.id !== "gmail")
          .map((provider) => (
            <li key={provider.id} className="provider-row">
              <ProviderMark provider={provider} />
              <div className="provider-body">
                <div className="provider-title">
                  <h2>{provider.name}</h2>
                  <span className="status-tag">Coming soon</span>
                </div>
                <p>{provider.description}</p>
                <p className="provider-enables">{provider.enables.join(" · ")}</p>
              </div>
            </li>
          ))}
      </ul>
    </div>
  );
};
