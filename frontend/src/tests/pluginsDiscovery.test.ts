import { describe, expect, it } from "vitest";
import { STATIC_PLUGIN_CATALOG } from "../features/plugins/catalog";
import type { PluginCategory, PluginListing } from "../features/plugins/types";

function filterCatalogue(
  catalog: PluginListing[],
  params: {
    category?: PluginCategory;
    search?: string;
    viewMode?: "discover" | "installed";
  },
): PluginListing[] {
  const { category = "All", search = "", viewMode = "discover" } = params;
  const q = search.trim().toLowerCase();

  return catalog.filter((plugin) => {
    if (viewMode === "installed" && !plugin.is_installed) {
      return false;
    }
    if (category !== "All" && plugin.category.toLowerCase() !== category.toLowerCase()) {
      return false;
    }
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
}

describe("Plugins Discovery & Search Filtering", () => {
  it("filters by category correctly", () => {
    const commPlugins = filterCatalogue(STATIC_PLUGIN_CATALOG, { category: "Communication" });
    expect(commPlugins.length).toBeGreaterThan(0);
    expect(commPlugins.every((p) => p.category === "Communication")).toBe(true);
    expect(commPlugins.some((p) => p.id === "gmail")).toBe(true);

    const devPlugins = filterCatalogue(STATIC_PLUGIN_CATALOG, { category: "Development" });
    expect(devPlugins.length).toBeGreaterThan(0);
    expect(devPlugins.every((p) => p.category === "Development")).toBe(true);
    expect(devPlugins.some((p) => p.id === "github")).toBe(true);

    const eduPlugins = filterCatalogue(STATIC_PLUGIN_CATALOG, { category: "Education" });
    expect(eduPlugins.length).toBeGreaterThanOrEqual(2);
    expect(eduPlugins.some((p) => p.id === "google-classroom")).toBe(true);
    expect(eduPlugins.some((p) => p.id === "university-portal")).toBe(true);
  });

  it("filters by text search across name, summary, description, and capabilities", () => {
    // Search by name
    const githubRes = filterCatalogue(STATIC_PLUGIN_CATALOG, { search: "GitHub" });
    expect(githubRes.some((p) => p.id === "github")).toBe(true);

    // Search by capability keyword (e.g. "triage" or "OAuth" or "PR")
    const triageRes = filterCatalogue(STATIC_PLUGIN_CATALOG, { search: "triage" });
    expect(triageRes.length).toBeGreaterThan(0);

    // Search for nonexistent term
    const noRes = filterCatalogue(STATIC_PLUGIN_CATALOG, { search: "xyz_nonexistent_term_999" });
    expect(noRes.length).toBe(0);
  });

  it("distinguishes discover vs installed views", () => {
    // With all plugins uninstalled
    const installedEmpty = filterCatalogue(STATIC_PLUGIN_CATALOG, { viewMode: "installed" });
    expect(installedEmpty.length).toBe(0);

    // If one plugin is installed
    const modifiedCatalog = STATIC_PLUGIN_CATALOG.map((p) =>
      p.id === "github" ? { ...p, is_installed: true } : p,
    );

    const installedRes = filterCatalogue(modifiedCatalog, { viewMode: "installed" });
    expect(installedRes.length).toBe(1);
    expect(installedRes[0].id).toBe("github");

    // Discover view still returns all items
    const discoverRes = filterCatalogue(modifiedCatalog, { viewMode: "discover" });
    expect(discoverRes.length).toBe(STATIC_PLUGIN_CATALOG.length);
  });
});
