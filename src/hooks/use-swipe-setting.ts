import { useCallback, useEffect, useState } from "react";

const KEY = "lifehub.swipeTabs";

/**
 * Om svep mellan flikar ska vara på. Sparas lokalt per enhet.
 * Läses efter hydrering för att undvika SSR-mismatch.
 */
export function useSwipeTabsSetting() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw !== null) setEnabled(raw === "1");
    } catch {
      /* ignorera */
    }
  }, []);

  const update = useCallback((value: boolean) => {
    setEnabled(value);
    try {
      window.localStorage.setItem(KEY, value ? "1" : "0");
    } catch {
      /* ignorera */
    }
  }, []);

  return { swipeEnabled: enabled, setSwipeEnabled: update };
}
