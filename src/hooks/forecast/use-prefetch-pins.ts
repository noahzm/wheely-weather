import { useEffect } from 'react';

import { getMemoryCachedForecast, setMemoryCachedForecast } from '@/services/forecastCache';
import { getForecastSnapshot } from '@/services/forecastSnapshot';
import type { RecentLocation, SavedLocation } from '@/services/locationStorage';
import { DEFAULT_RIDE_DURATION, type ExposureLevel, type RideDuration } from '@/types/settings';

import { applyExtras } from './merge-extras';

/**
 * Silently prefetches forecast snapshots for pinned locations in the background
 * so that switching between pins is instantaneous.
 */
export function usePrefetchPins(
  pinnedLocations: RecentLocation[],
  homeLocation: SavedLocation | null,
  exposureLevel: ExposureLevel,
  mockScenario: string | null,
  rideDuration: RideDuration = DEFAULT_RIDE_DURATION,
): void {
  useEffect(() => {
    if (mockScenario || pinnedLocations.length === 0) return;
    let cancelled = false;
    const isCancelled = () => cancelled;
    const settings = { homeLocation, exposureLevel, rideDuration };
    const timer = setTimeout(() => {
      for (const pin of pinnedLocations) {
        if (getMemoryCachedForecast(pin, undefined, settings)) continue;
        const target: SavedLocation = {
          lat: pin.lat,
          lon: pin.lon,
          name: pin.label,
          source: 'manual',
        };
        void getForecastSnapshot({
          savedLocation: target,
          homeLocation,
          exposureLevel,
          rideDuration,
        })
          .then(async ({ snapshot, extras }) => {
            if (isCancelled()) return;
            setMemoryCachedForecast(target, snapshot);
            // Keep the alerts and AQI already fetched, so a switch to this pin
            // shows them at once instead of after its reload. A load of the pin
            // since then owns the entry; leave its newer snapshot alone.
            const merged = applyExtras(snapshot, await extras);
            if (
              !isCancelled() &&
              merged &&
              getMemoryCachedForecast(target)?.snapshot === snapshot
            ) {
              setMemoryCachedForecast(target, merged);
            }
          })
          .catch(() => {
            /* best-effort background prefetch */
          });
      }
    }, 1000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pinnedLocations, homeLocation, exposureLevel, mockScenario, rideDuration]);
}
