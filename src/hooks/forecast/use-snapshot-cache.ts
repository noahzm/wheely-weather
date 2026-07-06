import { useEffect, type Dispatch, type SetStateAction } from 'react';

import { loadCachedForecast, saveCachedForecast } from '@/services/forecastCache';

import type { ForecastState } from './load-forecast-data';

/**
 * Paints the last cached forecast while the network load is in flight, so a
 * relaunch shows content instantly instead of a spinner. Race-safe with the
 * mount load: if the live fetch resolves first, the guard drops the stale
 * cache; if the cache lands first, the in-flight load completes as a
 * background refresh (the load reducer derives `loading` from the absence of
 * a snapshot).
 */
export function useSnapshotCacheHydration(
  setState: Dispatch<SetStateAction<ForecastState>>,
  mockScenario: string | null,
): void {
  useEffect(() => {
    if (mockScenario) return;
    let cancelled = false;
    void loadCachedForecast().then((cached) => {
      if (!cached || cancelled) return;
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
    });
    return () => {
      cancelled = true;
    };
  }, [setState, mockScenario]);
}

/** Persists each live (non-mock) snapshot so the next launch can hydrate from it. */
export function useSnapshotCachePersistence(state: ForecastState): void {
  const { snapshot, savedLocation } = state;
  useEffect(() => {
    if (!snapshot || !savedLocation) return;
    if (snapshot.mockScenario !== null) return;
    void saveCachedForecast(snapshot, savedLocation);
  }, [snapshot, savedLocation]);
}
