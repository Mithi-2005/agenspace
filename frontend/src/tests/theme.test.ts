import { describe, expect, it, beforeEach } from "vitest";
import {
  THEME_STORAGE_KEY,
  applyTheme,
  persistThemePreference,
  readThemePreference,
} from "../theme/theme";

describe("theme preference", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-preference");
  });

  it("defaults to system and persists the selected preference without storing tokens", () => {
    expect(readThemePreference()).toBe("system");
    persistThemePreference("dark");
    expect(readThemePreference()).toBe("dark");
    expect(window.localStorage.getItem("access_token")).toBeNull();
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("applies resolved theme attributes for explicit light and dark", () => {
    expect(applyTheme("light")).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(applyTheme("dark")).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme-preference")).toBe("dark");
  });
});
