import { useCallback, useEffect, useRef, useState } from 'react';

import {
  saveLocation,
  saveRecentLocation,
  type RecentLocation,
  type SavedLocation,
} from '@/services/locationStorage';
import { getForecastErrorKind } from '@/services/forecastSnapshot';
import { useHomeLocation } from '@/hooks/settings-context';

import {
  isWebInsecureContext,
  LOCATION_DENIED_MESSAGE,
  LOCATION_INSECURE_MESSAGE,
  requestDeviceLocation,
} from './forecast/device-location';
import {
  INITIAL_FORECAST_STATE,
  loadForecastData,
  persistResolvedDeviceName,
  togglePinnedLocation,
  type ForecastState,
} from './forecast/load-forecast-data';
import { useStaleRefresh } from './forecast/use-stale-refresh';

export function useWeatherForecast(mockScenario: string | null) {
  const [state, setState] = useState<ForecastState>(INITIAL_FORECAST_STATE);
  const [homeLocation] = useHomeLocation();
  const lastLoadedAt = useRef(0);
  const needsLocationRef = useRef(false);

  const loadForecast = useCallback(
    async (locationOverride?: SavedLocation | null, refreshOnly = false) => {
      setState((current) => ({
        ...current,
        loading: !current.snapshot && !refreshOnly && !current.needsLocation,
        refreshing: !!current.snapshot || refreshOnly,
        errorKind: null,
      }));

      try {
        const result = await loadForecastData(locationOverride, mockScenario, homeLocation);
        if (result.kind === 'needsLocation') {
          needsLocationRef.current = true;
          setState((current) => ({
            ...current,
            snapshot: null,
            savedLocation: null,
            recentLocations: result.recentLocations,
            pinnedLocations: result.pinnedLocations,
            loading: false,
            refreshing: false,
            needsLocation: true,
            errorKind: null,
            statusMessage: '',
          }));
          return;
        }

        persistResolvedDeviceName(result);

        lastLoadedAt.current = Date.now();
        needsLocationRef.current = false;
        setState((current) => ({
          ...current,
          snapshot: result.snapshot,
          savedLocation: result.savedLocation,
          recentLocations: result.recentLocations,
          pinnedLocations: result.pinnedLocations,
          loading: false,
          refreshing: false,
          needsLocation: false,
          errorKind: null,
          statusMessage: '',
        }));
      } catch (error) {
        setState((current) => ({
          ...current,
          loading: false,
          refreshing: false,
          errorKind: getForecastErrorKind(error),
        }));
      }
    },
    [mockScenario, homeLocation],
  );

  useEffect(() => {
    void loadForecast();
  }, [loadForecast]);

  useStaleRefresh(loadForecast, lastLoadedAt, needsLocationRef);

  const refresh = useCallback(() => {
    if (needsLocationRef.current) return;
    void loadForecast(undefined, true);
  }, [loadForecast]);

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
    [loadForecast],
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
  }, [loadForecast]);

  const togglePin = useCallback(
    async (place: RecentLocation) => {
      const pins = await togglePinnedLocation(place, state.pinnedLocations);
      setState((current) => ({ ...current, pinnedLocations: pins }));
    },
    [state.pinnedLocations],
  );

  return {
    ...state,
    refresh,
    setManualLocation,
    useDeviceLocation,
    togglePin,
  };
}
