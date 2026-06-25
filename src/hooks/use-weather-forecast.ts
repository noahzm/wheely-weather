import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';

import {
  clearLocation,
  loadRecentLocations,
  loadSavedLocation,
  saveLocation,
  saveRecentLocation,
  type RecentLocation,
  type SavedLocation,
} from '@/services/locationStorage';
import {
  getForecastErrorKind,
  getForecastSnapshot,
  type ForecastSnapshot,
} from '@/services/forecastSnapshot';
import { DEFAULT_LOCATION } from '@/services/weatherService';

const STALE_REFRESH_MS = 15 * 60 * 1000;

type ForecastState = {
  snapshot: ForecastSnapshot | null;
  savedLocation: SavedLocation | null;
  recentLocations: RecentLocation[];
  loading: boolean;
  refreshing: boolean;
  errorKind: 'network' | 'default' | null;
  statusMessage: string;
};

export function useWeatherForecast(mockScenario: string | null) {
  const [state, setState] = useState<ForecastState>({
    snapshot: null,
    savedLocation: null,
    recentLocations: [],
    loading: true,
    refreshing: false,
    errorKind: null,
    statusMessage: '',
  });
  const lastLoadedAt = useRef(0);

  const loadForecast = useCallback(
    async (locationOverride?: SavedLocation | null, refreshOnly = false) => {
      setState((current) => ({
        ...current,
        loading: !current.snapshot && !refreshOnly,
        refreshing: !!current.snapshot || refreshOnly,
        errorKind: null,
      }));

      try {
        const [savedLocation, recentLocations] = await Promise.all([
          locationOverride === undefined ? loadSavedLocation() : Promise.resolve(locationOverride),
          loadRecentLocations(),
        ]);
        const snapshot = await getForecastSnapshot({ savedLocation, mockScenario });
        lastLoadedAt.current = Date.now();
        setState((current) => ({
          ...current,
          snapshot,
          savedLocation,
          recentLocations,
          loading: false,
          refreshing: false,
          errorKind: null,
          statusMessage: '',
        }));
      } catch (err) {
        setState((current) => ({
          ...current,
          loading: false,
          refreshing: false,
          errorKind: getForecastErrorKind(err),
        }));
      }
    },
    [mockScenario],
  );

  useEffect(() => {
    loadForecast();
  }, [loadForecast]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState !== 'active') return;
      if (!lastLoadedAt.current || Date.now() - lastLoadedAt.current > STALE_REFRESH_MS) {
        loadForecast(undefined, true);
      }
    });
    return () => subscription.remove();
  }, [loadForecast]);

  const refresh = useCallback(() => loadForecast(undefined, true), [loadForecast]);

  const setManualLocation = useCallback(
    async (place: RecentLocation) => {
      const next = await saveLocation({
        lat: place.lat,
        lon: place.lon,
        name: place.label,
        source: 'manual',
      });
      await saveRecentLocation(place);
      setState((current) => ({ ...current, statusMessage: 'Updating forecast...' }));
      await loadForecast(next, true);
    },
    [loadForecast],
  );

  const useDeviceLocation = useCallback(async () => {
    setState((current) => ({ ...current, statusMessage: 'Checking your device location...' }));
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== Location.PermissionStatus.GRANTED) {
      setState((current) => ({
        ...current,
        statusMessage: `Location denied. Showing ${DEFAULT_LOCATION}.`,
      }));
      return false;
    }
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const next = await saveLocation({
      lat: position.coords.latitude,
      lon: position.coords.longitude,
      name: null,
      source: 'device',
    });
    setState((current) => ({ ...current, statusMessage: 'Location found. Updating forecast...' }));
    await loadForecast(next, true);
    return true;
  }, [loadForecast]);

  const useDefaultLocation = useCallback(async () => {
    await clearLocation();
    setState((current) => ({
      ...current,
      statusMessage: `Showing ${DEFAULT_LOCATION}.`,
    }));
    await loadForecast(null, true);
  }, [loadForecast]);

  return {
    ...state,
    refresh,
    setManualLocation,
    useDeviceLocation,
    useDefaultLocation,
  };
}
