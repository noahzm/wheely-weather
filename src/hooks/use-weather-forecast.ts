import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';

import {
  addPinnedLocation,
  loadPinnedLocations,
  loadRecentLocations,
  loadSavedLocation,
  removePinnedLocation,
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
import { useHomeLocation } from '@/hooks/settings-context';

const STALE_REFRESH_MS = 15 * 60 * 1000;
const LOCATION_DENIED_MESSAGE = 'Location access denied. Search for a city instead.';

interface ForecastState {
  snapshot: ForecastSnapshot | null;
  savedLocation: SavedLocation | null;
  recentLocations: RecentLocation[];
  pinnedLocations: RecentLocation[];
  loading: boolean;
  refreshing: boolean;
  needsLocation: boolean;
  errorKind: 'network' | 'default' | null;
  statusMessage: string;
}

const INITIAL_FORECAST_STATE: ForecastState = {
  snapshot: null,
  savedLocation: null,
  recentLocations: [],
  pinnedLocations: [],
  loading: true,
  refreshing: false,
  needsLocation: false,
  errorKind: null,
  statusMessage: '',
};

type ForecastLoadResult =
  | { kind: 'needsLocation'; recentLocations: RecentLocation[]; pinnedLocations: RecentLocation[] }
  | {
      kind: 'loaded';
      snapshot: ForecastSnapshot;
      savedLocation: SavedLocation | null;
      recentLocations: RecentLocation[];
      pinnedLocations: RecentLocation[];
    };

async function resolveDeviceLocation(
  requestIfUndetermined: boolean,
): Promise<SavedLocation | null> {
  let permission = await Location.getForegroundPermissionsAsync();
  if (permission.status === Location.PermissionStatus.UNDETERMINED && requestIfUndetermined) {
    permission = await Location.requestForegroundPermissionsAsync();
  }
  if (permission.status !== Location.PermissionStatus.GRANTED) {
    return null;
  }
  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return saveLocation({
    lat: position.coords.latitude,
    lon: position.coords.longitude,
    name: null,
    source: 'device',
  });
}

async function loadForecastData(
  locationOverride: SavedLocation | null | undefined,
  mockScenario: string | null,
  homeLocation: SavedLocation | null,
): Promise<ForecastLoadResult> {
  const [storedLocation, recentLocations, pinnedLocations] = await Promise.all([
    locationOverride === undefined ? loadSavedLocation() : Promise.resolve(locationOverride),
    loadRecentLocations(),
    loadPinnedLocations(),
  ]);

  let savedLocation = storedLocation;
  if (!mockScenario && !savedLocation) {
    savedLocation = await resolveDeviceLocation(true);
    if (!savedLocation) {
      return { kind: 'needsLocation', recentLocations, pinnedLocations };
    }
  }

  const snapshot = await getForecastSnapshot({ savedLocation, homeLocation, mockScenario });
  return { kind: 'loaded', snapshot, savedLocation, recentLocations, pinnedLocations };
}

async function requestDeviceLocation(): Promise<SavedLocation | null> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== Location.PermissionStatus.GRANTED) {
    return null;
  }
  return resolveDeviceLocation(false);
}

async function togglePinnedLocation(
  place: RecentLocation,
  pinned: RecentLocation[],
): Promise<RecentLocation[]> {
  const pinnedNow = pinned.some((p) => p.lat === place.lat && p.lon === place.lon);
  return pinnedNow ? removePinnedLocation(place.lat, place.lon) : addPinnedLocation(place);
}

function useStaleRefreshEffect(
  loadForecast: (override?: SavedLocation | null, refreshOnly?: boolean) => Promise<void>,
  lastLoadedAt: RefObject<number>,
  needsLocationRef: RefObject<boolean>,
) {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState !== 'active') return;
      if (needsLocationRef.current) return;
      if (!lastLoadedAt.current || Date.now() - lastLoadedAt.current > STALE_REFRESH_MS) {
        void loadForecast(undefined, true);
      }
    });
    return () => {
      subscription.remove();
    };
  }, [loadForecast, lastLoadedAt, needsLocationRef]);
}

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

  useStaleRefreshEffect(loadForecast, lastLoadedAt, needsLocationRef);

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
