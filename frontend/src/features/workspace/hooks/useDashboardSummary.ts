import { useCallback, useEffect, useState } from "react";
import { getDashboardApi, type DashboardSummary } from "../../../api/dashboard";

/** Loads the authenticated account's real dashboard aggregate. */
export function useDashboardSummary() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setSummary(await getDashboardApi());
    } catch {
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  return { summary, isLoading, refresh };
}
