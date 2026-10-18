import { describe, expect, it } from "vitest";
import { PLUGIN_CATEGORIES, STATIC_PLUGIN_CATALOG } from "../features/plugins/catalog";

describe("Plugins Marketplace Catalog", () => {
  it("contains all required initial catalogue entries", () => {
    const ids = STATIC_PLUGIN_CATALOG.map((p) => p.id);
    const requiredIds = [
      "gmail",
      "google-classroom",
      "google-calendar",
      "github",
      "university-portal",
    ];

    for (const reqId of requiredIds) {
      expect(ids).toContain(reqId);
    }
  });

  it("exposes strictly typed metadata on each plugin entry", () => {
    for (const plugin of STATIC_PLUGIN_CATALOG) {
      expect(plugin.id).toBeTruthy();
      expect(plugin.name).toBeTruthy();
      expect(plugin.summary).toBeTruthy();
      expect(plugin.description).toBeTruthy();
      expect(plugin.icon).toBeTruthy();

      // Publisher identity
      expect(plugin.publisher.name).toBeTruthy();
      expect(typeof plugin.publisher.verified).toBe("boolean");

      // Planned status
      expect(plugin.status).toBe("planned");
      expect(plugin.integration_status).toBe("planned");

      // Capabilities and permissions
      expect(plugin.capabilities.length).toBeGreaterThan(0);
      expect(plugin.permissions.length).toBeGreaterThan(0);
      for (const perm of plugin.permissions) {
        expect(perm.scope).toBeTruthy();
        expect(perm.description).toBeTruthy();
        expect(typeof perm.required).toBe("boolean");
      }

      // Setup requirements
      expect(plugin.setup_requirements).toBeTruthy();

      // Explicit 5-stage lifecycle separation
      expect(plugin.lifecycle.listing).toBe("available");
      expect(plugin.lifecycle.installation).toBe("not_installed");
      expect(plugin.lifecycle.connection).toBe("unavailable");
      expect(plugin.lifecycle.synchronization).toBe("never");
      expect(plugin.lifecycle.runtime_capabilities).toBe("planned");

      // Initial state
      expect(plugin.is_installed).toBe(false);
      expect(plugin.installed_at).toBeNull();
    }
  });

  it("covers all required marketplace categories", () => {
    expect(PLUGIN_CATEGORIES).toEqual([
      "All",
      "Productivity",
      "Communication",
      "Education",
      "Development",
      "Calendar",
    ]);

    const activeCategories = new Set(STATIC_PLUGIN_CATALOG.map((p) => p.category));
    expect(activeCategories.has("Communication")).toBe(true);
    expect(activeCategories.has("Education")).toBe(true);
    expect(activeCategories.has("Calendar")).toBe(true);
    expect(activeCategories.has("Development")).toBe(true);
    expect(activeCategories.has("Productivity")).toBe(true);
  });

  it("maintains separation between installation and external connection lifecycle", () => {
    // When a plugin is marked installed, its external connection must remain unavailable
    const sample = { ...STATIC_PLUGIN_CATALOG[0] };
    const installedSample = {
      ...sample,
      is_installed: true,
      installed_at: new Date().toISOString(),
      lifecycle: {
        ...sample.lifecycle,
        installation: "installed" as const,
      },
    };

    expect(installedSample.is_installed).toBe(true);
    expect(installedSample.lifecycle.installation).toBe("installed");
    // Crucial: connection and sync must NOT be considered complete just because plugin is installed
    expect(installedSample.lifecycle.connection).toBe("unavailable");
    expect(installedSample.lifecycle.synchronization).toBe("never");
  });
});
