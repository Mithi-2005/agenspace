import { useEffect, useState } from "react";
import { parseHashRoute, type AppRoute } from "./hashRoute";

export function useHashRoute(): AppRoute {
  const [route, setRoute] = useState<AppRoute>(() =>
    parseHashRoute(typeof window === "undefined" ? "" : window.location.hash),
  );

  useEffect(() => {
    const onChange = () => setRoute(parseHashRoute(window.location.hash));
    window.addEventListener("hashchange", onChange);
    onChange();
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return route;
}
