import { useEffect, useState } from "react";

/** Returns true once for each route key so entrance motion does not replay on state updates. */
export function useRevealOnce(key: string): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    setShown(false);
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, [key]);
  return shown;
}
