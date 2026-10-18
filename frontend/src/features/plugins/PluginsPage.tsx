import {
  AlertCircle,
  Blocks,
  Calendar,
  Check,
  CheckCircle2,
  ExternalLink,
  FileText,
  Filter,
  GraduationCap,
  Info,
  Lock,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
import { fetchPlugins, installPlugin, uninstallPlugin } from "./api";
import { useToast } from "../../context/ToastContext";
import { PLUGIN_CATEGORIES, STATIC_PLUGIN_CATALOG } from "./catalog";
import type { PluginCategory, PluginListing } from "./types";

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

  // Close on Escape key press
  useEffect(() => {
    if (!plugin) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
                <span className="plugin-badge-status">Planned Integration</span>
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

          {/* Explicit Lifecycle Architecture Breakdown */}
          <section className="plugin-modal-section lifecycle-section">
            <div className="section-title-wrap">
              <h3>Integration Lifecycle</h3>
              <span className="lifecycle-note">5 distinct phases</span>
            </div>
            <div className="lifecycle-stepper">
              <div className="lifecycle-step is-complete">
                <div className="lifecycle-step-num">1</div>
                <div className="lifecycle-step-body">
                  <strong>Catalogue Listing</strong>
                  <span className="lifecycle-step-status">Published & Verified</span>
                </div>
              </div>
              <div className={`lifecycle-step ${plugin.is_installed ? "is-complete" : "is-pending"}`}>
                <div className="lifecycle-step-num">2</div>
                <div className="lifecycle-step-body">
                  <strong>Workspace Installation</strong>
                  <span className="lifecycle-step-status">
                    {plugin.is_installed ? "Installed in Workspace" : "Not Installed"}
                  </span>
                </div>
              </div>
              <div className="lifecycle-step is-waiting">
                <div className="lifecycle-step-num">3</div>
                <div className="lifecycle-step-body">
                  <strong>External Connection</strong>
                  <span className="lifecycle-step-status">Pending official provider release</span>
                </div>
              </div>
              <div className="lifecycle-step is-waiting">
                <div className="lifecycle-step-num">4</div>
                <div className="lifecycle-step-body">
                  <strong>Data Synchronization</strong>
                  <span className="lifecycle-step-status">Not synced</span>
                </div>
              </div>
              <div className="lifecycle-step is-waiting">
                <div className="lifecycle-step-num">5</div>
                <div className="lifecycle-step-body">
                  <strong>Runtime Capabilities</strong>
                  <span className="lifecycle-step-status">Standby for Moon assistant</span>
                </div>
              </div>
            </div>
          </section>

          {/* Supported capabilities */}
          <section className="plugin-modal-section">
            <h3>Supported Capabilities</h3>
            <p className="section-helper">
              Once connected, Moon and AgenSpace workflows will be authorized to perform these actions:
            </p>
            <ul className="capabilities-checklist">
              {plugin.capabilities.map((cap) => (
                <li key={cap}>
                  <Zap size={14} className="icon-zap" aria-hidden="true" />
                  <span>{cap}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Permissions and security scopes */}
          <section className="plugin-modal-section">
            <div className="section-title-wrap">
              <h3>Requested Scopes & Permissions</h3>
              <span className="security-badge">
                <Lock size={12} aria-hidden="true" /> Granular Access
              </span>
            </div>
            <p className="section-helper">
              AgenSpace uses minimal required scopes. Consent will be requested during provider authorization.
            </p>
            <div className="permissions-table">
              {plugin.permissions.map((perm) => (
                <div key={perm.scope} className="permission-row">
                  <div className="permission-scope">
                    <code>{perm.scope}</code>
                    <span className={`perm-tag ${perm.required ? "tag-req" : "tag-opt"}`}>
                      {perm.required ? "Required" : "Optional"}
                    </span>
                  </div>
                  <p className="permission-desc">{perm.description}</p>
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
            <span>Planned integration: Live OAuth authorization will be activated in an upcoming milestone.</span>
          </div>
          <div className="plugin-modal-actions">
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
                  Install Plugin
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
  const [plugins, setPlugins] = useState<PluginListing[]>(STATIC_PLUGIN_CATALOG);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<PluginCategory>("All");
  const [viewMode, setViewMode] = useState<"discover" | "installed">("discover");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlugin, setSelectedPlugin] = useState<PluginListing | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadPlugins = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchPlugins();
      if (res && res.items && res.items.length > 0) {
        setPlugins(res.items);
      } else {
        setPlugins(STATIC_PLUGIN_CATALOG);
      }
    } catch {
      // Fallback to static catalog gracefully if offline or mock
      setPlugins(STATIC_PLUGIN_CATALOG);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlugins();
  }, [loadPlugins]);

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

  const filteredPlugins = useMemo(() => {
    const q = search.trim().toLowerCase();
    return plugins.filter((plugin) => {
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
  }, [plugins, search, selectedCategory, viewMode]);

  return (
    <div className="page-plugins">
      <header className="page-kicker">
        <div>
          <p className="date-line">Ecosystem & Integrations</p>
          <h1>Plugins Marketplace</h1>
        </div>
      </header>

      {/* Trust & Lifecycle Overview Panel */}
      <section className="panel marketplace-trust-panel">
        <div className="trust-panel-header">
          <div className="trust-badge">
            <ShieldCheck size={18} aria-hidden="true" />
            <h2>First-Class Integration Architecture</h2>
          </div>
          <p className="trust-lead">
            AgenSpace provides official connectors designed for privacy, explicit user consent, and future integration with Moon, your AI productivity companion.
          </p>
        </div>
        <div className="trust-columns">
          <div className="trust-col">
            <strong>1. Catalogue Listing</strong>
            <p>Verified metadata and strictly audited OAuth permissions for planned integrations.</p>
          </div>
          <div className="trust-col">
            <strong>2. Installation</strong>
            <p>Enables the plugin in your workspace without exposing third-party access until authorized.</p>
          </div>
          <div className="trust-col">
            <strong>3. Authorization</strong>
            <p>Direct external provider consent. No simulated or fake OAuth flows are presented.</p>
          </div>
          <div className="trust-col">
            <strong>4. Runtime Tools</strong>
            <p>Prepares authorized tool endpoints for Moon to assist you with tasks, calendar, and email.</p>
          </div>
        </div>
      </section>

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
            <span className="tab-count">{plugins.length}</span>
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

        <div className="marketplace-search-wrap">
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
        </div>
      </div>

      {/* Category Pills */}
      <div className="category-pills-bar" role="group" aria-label="Filter by category">
        <span className="category-label">
          <Filter size={13} aria-hidden="true" /> Categories:
        </span>
        <div className="category-pills-list">
          {PLUGIN_CATEGORIES.map((cat) => (
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
      </div>

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
      ) : filteredPlugins.length === 0 ? (
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
            const isProcessing = processingId === plugin.id;

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
                      <span className="plugin-badge-status">Planned</span>
                    </div>
                  </div>

                  <h2 className="plugin-card-title">{plugin.name}</h2>

                  <div className="plugin-card-publisher">
                    <span>{plugin.publisher.name}</span>
                    {plugin.publisher.verified && (
                      <span className="publisher-verified-chip" title="Verified Publisher">
                        <CheckCircle2 size={12} aria-hidden="true" />
                        Verified
                      </span>
                    )}
                  </div>

                  <p className="plugin-card-summary">{plugin.summary}</p>

                  <div className="plugin-capabilities-preview">
                    {plugin.capabilities.slice(0, 2).map((cap) => (
                      <span key={cap} className="capability-tag">
                        {cap}
                      </span>
                    ))}
                    {plugin.capabilities.length > 2 && (
                      <span className="capability-tag tag-more">
                        +{plugin.capabilities.length - 2} more
                      </span>
                    )}
                  </div>
                </div>

                <div className="plugin-card-bottom">
                  {/* Distinct Lifecycle Badges */}
                  <div className="plugin-lifecycle-pills">
                    <span
                      className={`lifecycle-pill ${
                        plugin.is_installed ? "pill-installed" : "pill-uninstalled"
                      }`}
                    >
                      {plugin.is_installed ? (
                        <>
                          <Check size={11} aria-hidden="true" /> Installed
                        </>
                      ) : (
                        "Not installed"
                      )}
                    </span>
                    <span className="lifecycle-pill pill-connection" title="External authorization state">
                      Provider pending v1.0
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="plugin-card-actions">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm btn-details"
                      onClick={() => setSelectedPlugin(plugin)}
                    >
                      Details & Permissions
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${
                        plugin.is_installed ? "btn-danger-outline" : "btn-lime"
                      }`}
                      onClick={() => void handleToggleInstall(plugin)}
                      disabled={isProcessing}
                      aria-label={`${plugin.is_installed ? "Uninstall" : "Install"} ${plugin.name}`}
                    >
                      {isProcessing ? (
                        <RefreshCw size={13} className="spin" aria-hidden="true" />
                      ) : plugin.is_installed ? (
                        "Uninstall"
                      ) : (
                        "Install"
                      )}
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
        onClose={() => setSelectedPlugin(null)}
        onToggleInstall={handleToggleInstall}
        isProcessing={processingId === selectedPlugin?.id}
      />
    </div>
  );
};
