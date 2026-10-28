import { useCallback, useEffect, useState } from "react";

export type SettingsSection =
  | "profile"
  | "security"
  | "notifications"
  | "moon"
  | "appearance"
  | "apps"
  | "data"
  | "delete";

export const SETTINGS_SECTIONS: SettingsSection[] = [
  "profile",
  "security",
  "notifications",
  "moon",
  "appearance",
  "apps",
  "data",
  "delete",
];

/**
 * Read the active settings section from hash.
 * Supports:
 *   #settings?s=profile   -> "profile"
 *   #settings/profile     -> "profile"
 *   #settings             -> null (caller will redirect to profile)
 *   #settings?s=unknown   -> "not-found"
 *   #settings/unknown     -> "not-found"
 */
export function readSettingsSection(hashString?: string): SettingsSection | "not-found" | null {
  const hash = (hashString ?? (typeof window !== "undefined" ? window.location.hash : "")).toLowerCase();
  if (!hash.startsWith("#settings")) return null;

  // Path-style: #settings/profile or #settings/profile?foo
  const afterSettings = hash.replace(/^#settings\/?/, "");
  const pathSlug = afterSettings.split("?")[0].replace(/\/+$/, "");
  if (pathSlug) {
    if ((SETTINGS_SECTIONS as string[]).includes(pathSlug)) {
      return pathSlug as SettingsSection;
    }
    return "not-found";
  }

  // Query-style: #settings?s=profile
  const match = hash.match(/[?&]s=([^&/#]*)/);
  const querySlug = match?.[1] ?? "";
  if (!querySlug) return null;
  if ((SETTINGS_SECTIONS as string[]).includes(querySlug)) {
    return querySlug as SettingsSection;
  }
  return "not-found";
}

export function useSettingsSection() {
  const [section, setSection] = useState<SettingsSection | "not-found" | null>(() => readSettingsSection());

  useEffect(() => {
    const onHash = () => {
      const parsed = readSettingsSection();
      if (parsed === null && window.location.hash.toLowerCase().startsWith("#settings")) {
        // Redirect bare #settings to #settings?s=profile
        window.location.hash = "settings?s=profile";
        setSection("profile");
      } else {
        setSection(parsed);
      }
    };

    window.addEventListener("hashchange", onHash);
    onHash();
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigateToSection = useCallback((s: SettingsSection) => {
    const next = `settings?s=${s}`;
    if (window.location.hash !== `#${next}`) {
      window.location.hash = next;
    }
    setSection(s);
  }, []);

  return {
    section: section ?? "profile",
    rawSection: section,
    navigateToSection,
  };
}
