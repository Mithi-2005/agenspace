import { describe, expect, it } from "vitest";
import { isWorkspaceRoute, parseHashRoute, routeToHash } from "../routing/hashRoute";

describe("hash routing", () => {
  it("maps public and workspace aliases", () => {
    expect(parseHashRoute("")).toBe("landing");
    expect(parseHashRoute("#")).toBe("landing");
    expect(parseHashRoute("#login")).toBe("login");
    expect(parseHashRoute("#register")).toBe("register");
    expect(parseHashRoute("#overview")).toBe("overview");
    expect(parseHashRoute("#myday")).toBe("tasks");
    expect(parseHashRoute("#connections")).toBe("manage");
    expect(parseHashRoute("#plugins")).toBe("marketplace");
    expect(parseHashRoute("#marketplace")).toBe("marketplace");
    expect(parseHashRoute("#integrations")).toBe("marketplace");
    expect(parseHashRoute("#account")).toBe("account");
  });

  it("keeps new workspace routes deep-linkable and sends unknown hashes to the workspace 404", () => {
    expect(parseHashRoute("#automations")).toBe("automations");
    expect(parseHashRoute("#does-not-exist")).toBe("not-found");
  });

  it("round-trips workspace hashes", () => {
    expect(routeToHash("overview")).toBe("#overview");
    expect(routeToHash("marketplace")).toBe("#marketplace");
    expect(isWorkspaceRoute("tasks")).toBe(true);
    expect(isWorkspaceRoute("marketplace")).toBe(true);
    expect(isWorkspaceRoute("login")).toBe(false);
  });
});
