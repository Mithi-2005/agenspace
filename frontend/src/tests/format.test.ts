import { describe, expect, it } from "vitest";
import { formatDateTime, fromDatetimeLocalValue, toDateLocalValue, toDatetimeLocalValue } from "../lib/format";

describe("formatDateTime", () => {
  it("renders a stored UTC instant in the message timezone once", () => {
    const formatted = formatDateTime("2026-10-18T09:30:00Z", "Asia/Kolkata");
    expect(formatted).toContain("3:00");
    expect(formatted).not.toContain("10:30");
  });
});

describe("timezone-aware event form values", () => {
  it("round trips an event time in the configured timezone", () => {
    const instant = fromDatetimeLocalValue("2026-10-18T15:00", "Asia/Kolkata");
    expect(instant).toBe("2026-10-18T09:30:00.000Z");
    expect(toDatetimeLocalValue(instant, "Asia/Kolkata")).toBe("2026-10-18T15:00");
  });

  it("preserves the local date for all-day events across UTC boundaries", () => {
    const midnight = fromDatetimeLocalValue("2026-10-18T00:00", "Asia/Kolkata");
    expect(midnight).toBe("2026-10-17T18:30:00.000Z");
    expect(toDateLocalValue(midnight!, "Asia/Kolkata")).toBe("2026-10-18");
    expect(formatDateTime(midnight!, "Asia/Kolkata", true)).not.toContain("12:00");
  });

  it("rejects a nonexistent local wall time during a daylight-saving jump", () => {
    expect(fromDatetimeLocalValue("2026-03-08T02:30", "America/New_York")).toBeNull();
  });
});
