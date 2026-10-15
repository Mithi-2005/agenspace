import React, { useEffect, useMemo, useState } from "react";
import {
  applyTheme,
  persistThemePreference,
  readThemePreference,
  resolveTheme,
  type ThemePreference,
} from "./theme";
import { ThemeContext } from "./themeContextDef";

function getSystemDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    typeof window === "undefined" ? "system" : readThemePreference(),
  );
  const [systemDark, setSystemDark] = useState(getSystemDark);

  useEffect(() => {
    applyTheme(preference);
    persistThemePreference(preference);
  }, [preference]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      setSystemDark(media.matches);
      if (preference === "system") {
        applyTheme("system");
      }
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  const resolved = preference === "system" ? (systemDark ? "dark" : "light") : resolveTheme(preference);

  const value = useMemo(
    () => ({
      preference,
      resolved,
      setPreference: setPreferenceState,
    }),
    [preference, resolved],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
