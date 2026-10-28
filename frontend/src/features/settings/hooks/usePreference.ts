import { useCallback, useEffect, useState } from "react";

/**
 * Typed hook for a boolean localStorage preference.
 *
 * Design constraints (from the auth security rules):
 * - NEVER reads or writes auth tokens, secrets, or bearer values.
 * - Storage errors are silently swallowed; preference still applies in-session.
 * - The default is used when the stored value is absent or unreadable.
 */
export function usePreference(
  key: string,
  defaultValue: boolean,
): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored === null) return defaultValue;
      return stored === "true";
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, String(value));
    } catch {
      // Best-effort persistence; preference still applies this session.
    }
  }, [key, value]);

  const set = useCallback((v: boolean) => setValue(v), []);
  return [value, set];
}
