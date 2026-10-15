import { describe, expect, it } from "vitest";
import { isWorkspaceRoute, parseHashRoute, routeToHash } from "../routing/hashRoute";

describe("hash routing", () => {
  it("maps public and workspace aliases", () => {
    expect(parseHashRoute("")).toBe("landing");
    expect(parseHashRoute("#")).toBe("landing");
    expect(parseHashRoute("#login")).toBe("login");
    expect(parseHashRoute("#register")).toBe("register");
    expect(parseHashRoute("#overview")).toBe("dashboard");
    expect(parseHashRoute("#myday")).toBe("tasks");
    expect(parseHashRoute("#connections")).toBe("connections");
    expect(parseHashRoute("#plugins")).toBe("plugins");
    expect(parseHashRoute("#marketplace")).toBe("plugins");
    expect(parseHashRoute("#integrations")).toBe("plugins");
    expect(parseHashRoute("#account")).toBe("account");
  });

  it("treats unknown hashes as the public landing route", () => {
    expect(parseHashRoute("#automations")).toBe("landing");
  });

  it("round-trips workspace hashes", () => {
    expect(routeToHash("dashboard")).toBe("#dashboard");
    expect(routeToHash("plugins")).toBe("#plugins");
    expect(isWorkspaceRoute("tasks")).toBe(true);
    expect(isWorkspaceRoute("plugins")).toBe(true);
    expect(isWorkspaceRoute("login")).toBe(false);
  });
});
