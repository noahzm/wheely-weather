import { useCallback, useEffect, useRef } from 'react';

import { useHomeLocation, useHomeLocationChosen } from '@/hooks/settings-context';
import type { SavedLocation } from '@/services/locationStorage';
import { pickAutoHomeLocation } from '@/utils/homeLocation';

/**
 * Returns a callback that makes a freshly loaded place the rider's home when
 * they have never chosen one (see `pickAutoHomeLocation`). Call it where the
 * snapshot is known to belong to `savedLocation`. Setting home changes
 * `loadForecast`, so the load effect refetches once with its climate applied.
 *
 * The chosen flag and setter are read through a ref: the settings setter
 * changes identity with every setting, so depending on it would make an
 * appearance toggle refetch the forecast.
 */
export function useAutoHomeLocation(mockScenario: string | null) {
  const [, setHomeLocation] = useHomeLocation();
  const homeLocationChosen = useHomeLocationChosen();
  const latest = useRef({ chosen: homeLocationChosen, set: setHomeLocation });
  useEffect(() => {
    latest.current = { chosen: homeLocationChosen, set: setHomeLocation };
  }, [homeLocationChosen, setHomeLocation]);

  return useCallback(
    (savedLocation: SavedLocation | null, placeName: string) => {
      const home = pickAutoHomeLocation({
        homeLocationChosen: latest.current.chosen,
        mockScenario,
        savedLocation,
        placeName,
      });
      if (home) latest.current.set(home);
    },
    [mockScenario],
  );
}
