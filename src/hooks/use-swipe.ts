import { useRef } from "react";

type SwipeOptions = {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** Minsta horisontella avstånd i px för att räknas som svep. */
  threshold?: number;
};

/**
 * Enkel svepdetektering för touchskärmar (iPhone).
 * Ignorerar vertikala svep så att vanlig scroll fungerar som förut.
 */
export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 55 }: SwipeOptions) {
  const start = useRef<{ x: number; y: number } | null>(null);

  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      start.current = { x: t.clientX, y: t.clientY };
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = start.current;
      start.current = null;
      const t = e.changedTouches[0];
      if (!s || !t) return;
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (dx < 0) onSwipeLeft?.();
      else onSwipeRight?.();
    },
  };
}
