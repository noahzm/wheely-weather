import { useCallback, type Dispatch, type RefObject, type SetStateAction } from 'react';

import {
  saveLocation,
  saveRecentLocation,
  type RecentLocation,
  type SavedLocation,
} from '@/services/locationStorage';
import { getMemoryCachedForecast } from '@/services/forecastCache';
import { captureError } from '@/services/telemetry';

import {
  getLastKnownDeviceLocation,
  isWebInsecureContext,
  LOCATION_DENIED_MESSAGE,
  LOCATION_INSECURE_MESSAGE,
  requestDeviceLocation,
  setLastKnownDeviceLocation,
} from './device-location';
import type { ForecastState } from './load-forecast-data';

type LoadForecast = (override?: SavedLocation | null, refreshOnly?: boolean) => Promise<void>;

export const LOCATION_SAVE_FAILED_MESSAGE = "Couldn't save that location. Try again.";

/**
 * User-initiated location changes: picking a place manually or using the
 * device fix. Both actions never reject — `saveLocation`/`getCurrentPositionAsync`
 * can throw (bad data, GPS off, storage failure), so failures are caught here
 * and surfaced via `statusMessage`, letting every call site treat these as
 * plain `Promise<boolean>` without its own try/catch.
 */
export function useLocationActions(
  setState: Dispatch<SetStateAction<ForecastState>>,
  loadForecast: LoadForecast,
  needsLocationRef: RefObject<boolean>,
) {
  const setManualLocation = useCallback(
    async (place: RecentLocation): Promise<boolean> => {
      const next: SavedLocation = {
        lat: place.lat,
        lon: place.lon,
        name: place.label,
        source: 'manual',
      };
      const cached = getMemoryCachedForecast(next);
      needsLocationRef.current = false;
      setState((current) => ({
        ...current,
        needsLocation: false,
        savedLocation: next,
        snapshot: cached ? cached.snapshot : current.snapshot,
        refreshing: !cached,
        statusMessage: '',
      }));

      // Async best-effort persistence
      void saveLocation(next).catch((error: unknown) => {
        captureError(error, { where: 'setManualLocation:save' });
      });
      void saveRecentLocation(place).catch((error: unknown) => {
        captureError(error, { where: 'saveRecentLocation' });
      });

      await loadForecast(next, true);
      return true;
    },
    [loadForecast, needsLocationRef, setState],
  );

  const useDeviceLocation = useCallback(async (): Promise<boolean> => {
    if (isWebInsecureContext()) {
      setState((current) => ({ ...current, statusMessage: LOCATION_INSECURE_MESSAGE }));
      return false;
    }
    const fastFix = getLastKnownDeviceLocation();
    if (fastFix) {
      const cached = getMemoryCachedForecast(fastFix);
      needsLocationRef.current = false;
      setState((current) => ({
        ...current,
        needsLocation: false,
        savedLocation: fastFix,
        snapshot: cached ? cached.snapshot : current.snapshot,
        refreshing: !cached,
        statusMessage: '',
      }));
    }

    let next: SavedLocation | null;
    try {
      next = await requestDeviceLocation();
    } catch {
      if (!fastFix) {
        setState((current) => ({ ...current, statusMessage: LOCATION_DENIED_MESSAGE }));
        return false;
      }
      return true;
    }
    if (!next) {
      if (!fastFix) {
        setState((current) => ({ ...current, statusMessage: LOCATION_DENIED_MESSAGE }));
        return false;
      }
      return true;
    }

    setLastKnownDeviceLocation(next);
    const cached = getMemoryCachedForecast(next);
    needsLocationRef.current = false;
    setState((current) => ({
      ...current,
      needsLocation: false,
      savedLocation: next,
      snapshot: cached ? cached.snapshot : current.snapshot,
      refreshing: !cached,
      statusMessage: '',
    }));
    await loadForecast(next, true);
    return true;
  }, [loadForecast, needsLocationRef, setState]);

  return { setManualLocation, useDeviceLocation };
}
