import { useCallback, type Dispatch, type RefObject, type SetStateAction } from 'react';

import {
  saveLocation,
  saveRecentLocation,
  type RecentLocation,
  type SavedLocation,
} from '@/services/locationStorage';

import {
  isWebInsecureContext,
  LOCATION_DENIED_MESSAGE,
  LOCATION_INSECURE_MESSAGE,
  requestDeviceLocation,
} from './device-location';
import type { ForecastState } from './load-forecast-data';

type LoadForecast = (override?: SavedLocation | null, refreshOnly?: boolean) => Promise<void>;

/** User-initiated location changes: picking a place manually or using the device fix. */
export function useLocationActions(
  setState: Dispatch<SetStateAction<ForecastState>>,
  loadForecast: LoadForecast,
  needsLocationRef: RefObject<boolean>,
) {
  const setManualLocation = useCallback(
    async (place: RecentLocation) => {
      const next = await saveLocation({
        lat: place.lat,
        lon: place.lon,
        name: place.label,
        source: 'manual',
      });
      await saveRecentLocation(place);
      needsLocationRef.current = false;
      setState((current) => ({
        ...current,
        needsLocation: false,
        statusMessage: 'Updating forecast...',
      }));
      await loadForecast(next, true);
    },
    [loadForecast, needsLocationRef, setState],
  );

  const useDeviceLocation = useCallback(async () => {
    if (isWebInsecureContext()) {
      setState((current) => ({ ...current, statusMessage: LOCATION_INSECURE_MESSAGE }));
      return false;
    }
    setState((current) => ({ ...current, statusMessage: 'Checking your device location...' }));
    const next = await requestDeviceLocation();
    if (!next) {
      setState((current) => ({ ...current, statusMessage: LOCATION_DENIED_MESSAGE }));
      return false;
    }
    needsLocationRef.current = false;
    setState((current) => ({
      ...current,
      needsLocation: false,
      statusMessage: 'Location found. Updating forecast...',
    }));
    await loadForecast(next, true);
    return true;
  }, [loadForecast, needsLocationRef, setState]);

  return { setManualLocation, useDeviceLocation };
}
