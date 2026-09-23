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
  deviceLocationErrorMessage,
  getLastKnownDeviceLocation,
  isWebInsecureContext,
  LOCATION_INSECURE_MESSAGE,
  requestDeviceLocation,
  setLastKnownDeviceLocation,
  type DeviceLocationResult,
} from './device-location';
import type { ForecastState } from './load-forecast-data';

type LoadForecast = (override?: SavedLocation | null, refreshOnly?: boolean) => Promise<void>;

/** Outcome of "Use Current Location"; a failure carries the message to show the rider. */
export type DeviceLocationOutcome = { ok: true } | { ok: false; message: string };

/**
 * User-initiated location changes: picking a place manually or using the
 * device fix. Both actions never reject, so every call site can treat them as
 * plain promises without their own try/catch. A denied or failed device fix is
 * surfaced via `statusMessage` and returned, so the screen that asked can show it; persisting the choice is best-effort and
 * non-blocking (the forecast still loads), so storage failures only go to Sentry.
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

  const useDeviceLocation = useCallback(async (): Promise<DeviceLocationOutcome> => {
    if (isWebInsecureContext()) {
      setState((current) => ({ ...current, statusMessage: LOCATION_INSECURE_MESSAGE }));
      return { ok: false, message: LOCATION_INSECURE_MESSAGE };
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

    let result: DeviceLocationResult;
    try {
      result = await requestDeviceLocation();
    } catch {
      result = { kind: 'unavailable' };
    }
    if (result.kind !== 'located') {
      if (!fastFix) {
        const message = deviceLocationErrorMessage(result.kind);
        setState((current) => ({ ...current, statusMessage: message }));
        return { ok: false, message };
      }
      // No fresh fix, so commit to the fast one: persist it (otherwise the next
      // launch reverts to the previous place) and load it, which also settles
      // the `refreshing` flag set above.
      void saveLocation(fastFix).catch((error: unknown) => {
        captureError(error, { where: 'useDeviceLocation:save' });
      });
      await loadForecast(fastFix, true);
      return { ok: true };
    }

    const next = result.location;
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
    return { ok: true };
  }, [loadForecast, needsLocationRef, setState]);

  return { setManualLocation, useDeviceLocation };
}
