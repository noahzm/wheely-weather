import { useEffect } from 'react';

import { getMemoryCachedForecast, setMemoryCachedForecast } from '@/services/forecastCache';
import { getForecastSnapshot } from '@/services/forecastSnapshot';
import type { RecentLocation, SavedLocation } from '@/services/locationStorage';
import type { ExposureLevel } from '@/types/settings';

/**
 * Silently prefetches forecast snapshots for pinned locations in the background
 * so that switching between pins is instantaneous.
 */
export function usePrefetchPins(
  pinnedLocations: RecentLocation[],
  homeLocation: SavedLocation | null,
  exposureLevel: ExposureLevel,
  mockScenario: string | null,
): void {
  useEffect(() => {
    if (mockScenario || pinnedLocations.length === 0) return;
    const timer = setTimeout(() => {
      for (const pin of pinnedLocations) {
        if (getMemoryCachedForecast(pin)) continue;
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
        })
          .then(({ snapshot }) => {
            setMemoryCachedForecast(target, snapshot);
          })
          .catch(() => {
            /* best-effort background prefetch */
          });
      }
    }, 1000);
    return () => {
      clearTimeout(timer);
    };
  }, [pinnedLocations, homeLocation, exposureLevel, mockScenario]);
}
