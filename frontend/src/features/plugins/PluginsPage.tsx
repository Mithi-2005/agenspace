import {
  AlertCircle,
  Blocks,
  Calendar,
  Check,
  ExternalLink,
  FileText,
  Filter,
  GraduationCap,
  Info,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { fetchPlugins, installPlugin, uninstallPlugin } from "./api";
import { useToast } from "../../context/ToastContext";
import { PLUGIN_CATEGORIES } from "./catalog";
import type { PluginCategory, PluginListing } from "./types";
import { navigateTo } from "../../routing/hashRoute";
import { getGoogleStatusApi } from "../../features/google/api";
import type { GoogleConnectionStatus } from "../../features/google/types";

const PluginIcon: React.FC<{ iconName: string; size?: number; strokeWidth?: number }> = ({
  iconName,
  size = 20,
  strokeWidth = 1.75,
}) => {
  switch (iconName) {
    case "mail":
      return <Mail size={size} strokeWidth={strokeWidth} />;
    case "graduation-cap":
    case "school":
      return <GraduationCap size={size} strokeWidth={strokeWidth} />;
    case "calendar":
      return <Calendar size={size} strokeWidth={strokeWidth} />;
    case "file-text":
      return <FileText size={size} strokeWidth={strokeWidth} />;
    case "github":
    default:
      return <Blocks size={size} strokeWidth={strokeWidth} />;
  }
};

interface PluginDetailModalProps {
  plugin: PluginListing | null;
  onClose: () => void;
  onToggleInstall: (plugin: PluginListing) => Promise<void>;
  isProcessing: boolean;
}

const PluginDetailModal: React.FC<PluginDetailModalProps> = ({
  plugin,
  onClose,
  onToggleInstall,
  isProcessing,
}) => {
  const dialogId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!plugin) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const focusFrame = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("button:not([disabled])")?.focus();
    });
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [plugin, onClose]);

  if (!plugin) return null;

  return (
    <div
      className="plugin-modal-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="plugin-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`plugin-title-${dialogId}`}
        aria-describedby={`plugin-desc-${dialogId}`}
      >
        <header className="plugin-modal-header">
          <div className="plugin-modal-title-row">
            <span className={`plugin-card-icon cat-${plugin.category.toLowerCase()}`} aria-hidden="true">
              <PluginIcon iconName={plugin.icon} size={24} strokeWidth={1.75} />
            </span>
            <div className="plugin-modal-titles">
              <div className="plugin-modal-name-wrap">
                <h2 id={`plugin-title-${dialogId}`}>{plugin.name}</h2>
                <span className="plugin-badge-status">{plugin.is_installed ? "Installed" : "Available"}</span>
              </div>
              <div className="plugin-modal-publisher">
                <span>By {plugin.publisher.name}</span>
                {plugin.publisher.verified && (
                  <span className="publisher-verified-chip" title="Verified Publisher">
                    <ShieldCheck size={13} aria-hidden="true" />
                    Verified Partner
                  </span>
                )}
                {plugin.publisher.support_url && (
                  <a
                    href={plugin.publisher.support_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="publisher-link"
                    aria-label={`Visit ${plugin.publisher.name} documentation (opens in new tab)`}
                  >
                    Documentation <ExternalLink size={12} aria-hidden="true" />
                  </a>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn plugin-modal-close"
            onClick={onClose}
            aria-label="Close plugin details"
          >
            <X size={18} />
          </button>
        </header>

        <div className="plugin-modal-body">
          <section className="plugin-modal-section">
            <h3>Overview</h3>
            <p id={`plugin-desc-${dialogId}`}>{plugin.description}</p>
          </section>

          <section className="plugin-modal-section">
            <h3>What it can do</h3>
            <ul className="capabilities-checklist">
              {plugin.capabilities.map((cap) => (
                <li key={cap}>
                  <span>{cap}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="plugin-modal-section">
            <div className="section-title-wrap">
              <h3>Permissions</h3>
            </div>
            <p className="section-helper">
              You will see the requested access before authorizing this provider.
            </p>
            <div className="permissions-table">
              {plugin.permissions.map((perm) => (
                <div key={perm.scope} className="permission-row">
                  <div className="permission-scope">
                    <span>{perm.description}</span>
                    <span className={`perm-tag ${perm.required ? "tag-req" : "tag-opt"}`}>
                      {perm.required ? "Required" : "Optional"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Connection Requirements */}
          <section className="plugin-modal-section">
            <h3>Setup & Prerequisites</h3>
            <p className="setup-callout">{plugin.setup_requirements}</p>
          </section>
        </div>

        <footer className="plugin-modal-footer">
          <div className="footer-status-info">
            <Info size={14} aria-hidden="true" />
            <span>
              {plugin.id === "gmail"
                ? "Gmail connection and sync are managed on the Connections page."
                : "Adding this listing saves it to your workspace. Provider connection and sync are not available for this listing."}
            </span>
          </div>
          <div className="plugin-modal-actions">
            {plugin.id === "gmail" ? (
              <button type="button" className="btn btn-outline" onClick={() => { onClose(); navigateTo("connections"); }}>
                Manage connection
              </button>
            ) : null}
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              className={`btn ${plugin.is_installed ? "btn-danger-outline" : "btn-lime"}`}
              onClick={() => void onToggleInstall(plugin)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <RefreshCw size={14} className="spin" aria-hidden="true" />
                  {plugin.is_installed ? "Uninstalling…" : "Installing…"}
                </>
              ) : plugin.is_installed ? (
                <>
                  <Trash2 size={14} aria-hidden="true" />
                  Uninstall Plugin
                </>
              ) : (
                <>
                  <Check size={14} aria-hidden="true" />
                  Add to workspace
                </>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export const PluginsPage: React.FC = () => {
  const { showToast } = useToast();
  const [plugins, setPlugins] = useState<PluginListing[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<PluginCategory>("All");
  const [viewMode, setViewMode] = useState<"discover" | "installed">("discover");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [googleStatus, setGoogleStatus] = useState<GoogleConnectionStatus | null>(null);
  const [googleStatusLoaded, setGoogleStatusLoaded] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState<PluginListing | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const closeSelectedPlugin = useCallback(() => setSelectedPlugin(null), []);

  const loadPlugins = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchPlugins();
      setPlugins(res?.items ?? []);
    } catch {
      setPlugins([]);
      setError("Integrations could not be loaded. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlugins();
  }, [loadPlugins]);

  useEffect(() => {
    let active = true;
    void getGoogleStatusApi()
      .then((status) => {
        if (active) setGoogleStatus(status);
      })
      .catch(() => {
        if (active) setGoogleStatus(null);
      })
      .finally(() => {
        if (active) setGoogleStatusLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Keep selected modal plugin synced with state
  useEffect(() => {
    if (selectedPlugin) {
      const updated = plugins.find((p) => p.id === selectedPlugin.id);
      if (updated) setSelectedPlugin(updated);
    }
  }, [plugins, selectedPlugin]);

  const handleToggleInstall = async (plugin: PluginListing) => {
    setProcessingId(plugin.id);
    try {
      if (plugin.is_installed) {
        await uninstallPlugin(plugin.id);
        setPlugins((prev) =>
          prev.map((p) =>
            p.id === plugin.id
              ? {
                  ...p,
                  is_installed: false,
                  installed_at: null,
                  lifecycle: {
                    ...p.lifecycle,
                    installation: "not_installed",
                  },
                }
              : p,
          ),
        );
        showToast(`${plugin.name} uninstalled from your workspace.`, "info");
      } else {
        await installPlugin(plugin.id);
        const nowIso = new Date().toISOString();
        setPlugins((prev) =>
          prev.map((p) =>
            p.id === plugin.id
              ? {
                  ...p,
                  is_installed: true,
                  installed_at: nowIso,
                  lifecycle: {
                    ...p.lifecycle,
                    installation: "installed",
                  },
                }
              : p,
          ),
        );
        showToast(`${plugin.name} installed into your workspace.`, "success");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update plugin status.";
      showToast(msg, "error");
    } finally {
      setProcessingId(null);
    }
  };

  const installedCount = useMemo(() => {
    return plugins.filter((p) => p.is_installed).length;
  }, [plugins]);

  const availablePlugins = useMemo(
    () => plugins.filter((plugin) => plugin.integration_status === "available" || plugin.is_installed),
    [plugins],
  );

  const visibleCategories = useMemo(
    () => PLUGIN_CATEGORIES.filter((category) =>
      availablePlugins.some((plugin) => plugin.category.toLowerCase() === category.toLowerCase()),
    ),
    [availablePlugins],
  );

  const filteredPlugins = useMemo(() => {
    const q = search.trim().toLowerCase();
    return availablePlugins.filter((plugin) => {
      // View mode filter
      if (viewMode === "installed" && !plugin.is_installed) {
        return false;
      }

      // Category filter
      if (selectedCategory !== "All" && plugin.category.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }

      // Search filter
      if (q) {
        const inName = plugin.name.toLowerCase().includes(q);
        const inDesc = plugin.description.toLowerCase().includes(q);
        const inSummary = plugin.summary.toLowerCase().includes(q);
        const inCategory = plugin.category.toLowerCase().includes(q);
        const inCapabilities = plugin.capabilities.some((c) => c.toLowerCase().includes(q));
        if (!inName && !inDesc && !inSummary && !inCategory && !inCapabilities) {
          return false;
        }
      }

      return true;
    });
  }, [availablePlugins, search, selectedCategory, viewMode]);

  return (
    <div className="page-plugins">
      <header className="page-kicker">
        <div>
          <h1>Integrations</h1>
        </div>
      </header>

      {/* Filter and Discovery Controls */}
      <div className="marketplace-controls">
        <div className="marketplace-view-tabs" role="tablist" aria-label="Plugin views">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "discover"}
            className={`view-tab ${viewMode === "discover" ? "is-active" : ""}`}
            onClick={() => setViewMode("discover")}
          >
            Discover
            <span className="tab-count">{availablePlugins.length - installedCount}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "installed"}
            className={`view-tab ${viewMode === "installed" ? "is-active" : ""}`}
            onClick={() => setViewMode("installed")}
          >
            Installed
            <span className={`tab-count ${installedCount > 0 ? "has-installed" : ""}`}>
              {installedCount}
            </span>
          </button>
        </div>

        {availablePlugins.length > 4 ? <div className="marketplace-search-wrap">
          <Search size={16} className="search-icon" aria-hidden="true" />
          <input
            type="search"
            className="marketplace-search-input"
            placeholder="Search by plugin name, description, or capability…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search plugins"
          />
          {search && (
            <button
              type="button"
              className="icon-btn search-clear-btn"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div> : null}
      </div>

      {/* Category Pills */}
      {new Set(availablePlugins.map((plugin) => plugin.category)).size > 1 ? <div className="category-pills-bar" role="group" aria-label="Filter by category">
        <span className="category-label">
          <Filter size={13} aria-hidden="true" /> Categories:
        </span>
        <div className="category-pills-list">
          {visibleCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`category-pill ${selectedCategory === cat ? "is-selected" : ""}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div> : null}

      {/* Error State */}
      {error && (
        <div className="panel error-panel" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <div className="error-body">
            <strong>Failed to load marketplace plugins</strong>
            <p>{error}</p>
          </div>
          <button type="button" className="btn btn-sm btn-outline" onClick={() => void loadPlugins()}>
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="plugins-loading-state" aria-busy="true">
          <RefreshCw size={24} className="spin" aria-hidden="true" />
          <p>Loading plugin marketplace…</p>
        </div>
      ) : error ? null : filteredPlugins.length === 0 ? (
        /* Empty States */
        <div className="panel marketplace-empty-state">
          <div className="empty-icon-wrap" aria-hidden="true">
            <Blocks size={32} />
          </div>
          {viewMode === "installed" && installedCount === 0 ? (
            <>
              <h3>No plugins installed yet</h3>
              <p>Explore the Discover view to install integrations into your workspace.</p>
              <button
                type="button"
                className="btn btn-lime btn-sm"
                onClick={() => setViewMode("discover")}
              >
                Browse Discover
              </button>
            </>
          ) : (
            <>
              <h3>No plugins found</h3>
              <p>
                No integration matches your current filters
                {search ? ` for "${search}"` : ""}.
              </p>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setSearch("");
                  setSelectedCategory("All");
                }}
              >
                Clear all filters
              </button>
            </>
          )}
        </div>
      ) : (
        /* Plugin Cards Grid */
        <div className="plugin-grid" role="list" aria-label="Plugins catalogue">
          {filteredPlugins.map((plugin) => {
            const isConnected = plugin.id === "gmail"
              ? googleStatus?.is_connected === true
              : plugin.lifecycle.connection === "connected";
            const connectionLabel = plugin.id === "gmail"
              ? googleStatus?.is_connected
                ? "Connected"
                : googleStatusLoaded
                  ? googleStatus
                    ? "Not connected"
                    : "Connection status unavailable"
                  : "Checking connection"
              : plugin.lifecycle.connection === "connected"
                ? "Connected"
                : plugin.lifecycle.connection === "disconnected"
                  ? "Not connected"
                  : "Connection unavailable";

            return (
              <article
                key={plugin.id}
                className={`plugin-card ${plugin.is_installed ? "is-installed" : ""}`}
                role="listitem"
              >
                <div className="plugin-card-top">
                  <div className="plugin-card-header">
                    <span
                      className={`plugin-card-icon cat-${plugin.category.toLowerCase()}`}
                      aria-hidden="true"
                    >
                      <PluginIcon iconName={plugin.icon} size={22} strokeWidth={1.75} />
                    </span>
                    <div className="plugin-card-meta">
                      <span className="plugin-card-category">{plugin.category}</span>
                      {plugin.is_installed ? <span className="plugin-badge-status">In workspace</span> : null}
                    </div>
                  </div>

                  <h2 className="plugin-card-title">{plugin.name}</h2>

                  <p className="plugin-card-summary">{plugin.summary}</p>
                </div>

                <div className="plugin-card-bottom">
                  <div className="plugin-lifecycle-pills" aria-live="polite">
                    <span className={`lifecycle-pill ${isConnected ? "pill-installed" : "pill-uninstalled"}`}>
                      {connectionLabel}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="plugin-card-actions">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm btn-details"
                      onClick={() => setSelectedPlugin(plugin)}
                    >
                      Details
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-lime"
                      onClick={() => plugin.id === "gmail" ? navigateTo("connections") : setSelectedPlugin(plugin)}
                      aria-label={`${isConnected ? "Manage" : "Connect"} ${plugin.name}`}
                    >
                      {isConnected ? "Manage connection" : plugin.id === "gmail" ? "Connect Gmail" : "View details"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Detail & Permissions Accessible Dialog */}
      <PluginDetailModal
        plugin={selectedPlugin}
        onClose={closeSelectedPlugin}
        onToggleInstall={handleToggleInstall}
        isProcessing={processingId === selectedPlugin?.id}
      />
    </div>
  );
};
