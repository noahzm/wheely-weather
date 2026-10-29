import { useEffect } from 'react';

import { getMemoryCachedForecast, setMemoryCachedForecast } from '@/services/forecastCache';
import { getForecastSnapshot } from '@/services/forecastSnapshot';
import type { RecentLocation, SavedLocation } from '@/services/locationStorage';
import {
  DEFAULT_NIGHT_RIDING,
  DEFAULT_RIDE_DURATION,
  type ExposureLevel,
  type RideDuration,
} from '@/types/settings';

import { applyExtras } from './merge-extras';

interface PrefetchPinSettings {
  homeLocation: SavedLocation | null;
  exposureLevel: ExposureLevel;
  rideDuration?: RideDuration;
  nightRiding?: boolean;
}

/**
 * Silently prefetches forecast snapshots for pinned locations in the background
 * so that switching between pins is instantaneous.
 */
export function usePrefetchPins(
  pinnedLocations: RecentLocation[],
  {
    homeLocation,
    exposureLevel,
    rideDuration = DEFAULT_RIDE_DURATION,
    nightRiding = DEFAULT_NIGHT_RIDING,
  }: PrefetchPinSettings,
  mockScenario: string | null,
): void {
  useEffect(() => {
    if (mockScenario || pinnedLocations.length === 0) return;
    let cancelled = false;
    const isCancelled = () => cancelled;
    const settings = { homeLocation, exposureLevel, rideDuration, nightRiding };
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
          nightRiding,
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
  }, [pinnedLocations, homeLocation, exposureLevel, mockScenario, rideDuration, nightRiding]);
}
