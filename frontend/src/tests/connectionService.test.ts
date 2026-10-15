import { describe, expect, it } from "vitest";
import { getConnectionCatalog } from "../services/connectionService";

describe("connection catalog", () => {
  it("exposes intended providers without marking them connected", () => {
    const catalog = getConnectionCatalog();
    expect(catalog.providers.map((provider) => provider.id)).toEqual([
      "gmail",
      "google-calendar",
      "outlook-calendar",
    ]);
    expect(catalog.implementedCount).toBe(0);
    expect(catalog.providers.every((provider) => provider.status === "not_implemented")).toBe(true);
  });
});
