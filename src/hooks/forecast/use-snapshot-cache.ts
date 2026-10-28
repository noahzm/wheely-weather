import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

import { loadCachedForecast } from '@/services/forecastCache';

import type { ForecastState } from './load-forecast-data';

/**
 * Paints the last cached forecast while the network load is in flight, so a
 * relaunch shows content instantly instead of a spinner. Race-safe with the
 * mount load: if the live fetch resolves first, the guard drops the stale
 * cache; if the cache lands first, the in-flight load completes as a
 * background refresh (the load reducer derives `loading` from the absence of
 * a snapshot).
 *
 * Returns `true` once the cache read has settled (or immediately in mock mode),
 * so the native launch screen can wait for cached content without waiting on
 * the network.
 */
export function useSnapshotCacheHydration(
  setState: Dispatch<SetStateAction<ForecastState>>,
  mockScenario: string | null,
): boolean {
  const [hydrated, setHydrated] = useState(mockScenario !== null);
  if (mockScenario !== null && !hydrated) {
    setHydrated(true);
  }

  useEffect(() => {
    if (mockScenario) return;
    let cancelled = false;
    void loadCachedForecast()
      .then((cached) => {
        if (cancelled) return;
        if (cached) {
          setState((current) => {
            if (current.snapshot !== null || current.needsLocation) return current;
            return {
              ...current,
              snapshot: cached.snapshot,
              savedLocation: cached.savedLocation,
              loading: false,
              // Only claim a refresh is happening if the mount load is still in
              // flight (it may already have failed, e.g. offline).
              refreshing: current.loading,
            };
          });
        }
        setHydrated(true);
      })
      .catch(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [setState, mockScenario]);

  return hydrated;
}
