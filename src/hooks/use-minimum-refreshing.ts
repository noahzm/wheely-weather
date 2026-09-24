import { useEffect, useRef, useState } from 'react';

/** Long enough for iOS to show the spinner and run its own collapse animation. */
const MIN_REFRESH_MS = 700;

/**
 * Holds a pull-to-refresh spinner up for a minimum time. A refresh that
 * settles within a frame or two (a cached or fast fetch) toggled
 * UIRefreshControl on and off mid-gesture, so the content jumped instead of
 * easing back. Display only: the forecast's own `refreshing` flag is untouched.
 */
export function useMinimumRefreshing(refreshing: boolean, minMs = MIN_REFRESH_MS): boolean {
  const [previous, setPrevious] = useState(refreshing);
  const [holding, setHolding] = useState(false);
  const startedAt = useRef(0);

  // Adjusted during render (not in an effect) so the frame where the refresh
  // ends already shows the hold, with no flash of "done".
  if (refreshing !== previous) {
    setPrevious(refreshing);
    if (!refreshing) setHolding(true);
  }

  useEffect(() => {
    if (refreshing) {
      startedAt.current = Date.now();
      return;
    }
    if (!holding) return;
    const remaining = Math.max(0, minMs - (Date.now() - startedAt.current));
    const timer = setTimeout(() => {
      setHolding(false);
    }, remaining);
    return () => {
      clearTimeout(timer);
    };
  }, [refreshing, holding, minMs]);

  return refreshing || holding;
}
