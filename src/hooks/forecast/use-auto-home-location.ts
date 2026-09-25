import { useCallback, useEffect, useRef } from 'react';

import { useAutoHomeSettings } from '@/hooks/settings-context';
import type { SavedLocation } from '@/services/locationStorage';
import { pickAutoHomeLocation } from '@/utils/homeLocation';

/**
 * Returns a callback that assigns (or upgrades) a provisional home after a
 * forecast loads (see `pickAutoHomeLocation`). Call it where the snapshot is
 * known to belong to `savedLocation`. Setting home changes `loadForecast`, so
 * the load effect refetches once with its climate applied.
 *
 * The settings are read through a ref: the settings setters change identity
 * with every setting, so depending on them would make an appearance toggle
 * refetch the forecast.
 */
export function useAutoHomeLocation(mockScenario: string | null) {
  const settings = useAutoHomeSettings();
  const latest = useRef(settings);
  useEffect(() => {
    latest.current = settings;
  });

  return useCallback(
    (savedLocation: SavedLocation | null, placeName: string) => {
      const { homeLocation, homeLocationChosen, homeLocationAuto, assignAutoHome } = latest.current;
      const home = pickAutoHomeLocation({
        homeLocation,
        homeLocationChosen,
        homeLocationAuto,
        mockScenario,
        savedLocation,
        placeName,
      });
      if (home) assignAutoHome(home);
    },
    [mockScenario],
  );
}
