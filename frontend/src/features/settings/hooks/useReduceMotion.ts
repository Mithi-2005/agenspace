import { useEffect, useState } from "react";

export function useReduceMotion(): [boolean, (value: boolean) => void] {
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const stored = window.localStorage.getItem("agenspace-pref-reduce-motion");
      if (stored !== null) return stored === "true";
      return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("agenspace-pref-reduce-motion", String(reducedMotion));
    } catch {
      // Best-effort persistence
    }
    if (reducedMotion) {
      document.documentElement.setAttribute("data-motion", "reduced");
    } else {
      document.documentElement.removeAttribute("data-motion");
    }
  }, [reducedMotion]);

  return [reducedMotion, setReducedMotion];
}
