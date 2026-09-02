import { type Dispatch, type SetStateAction } from 'react';
import { Platform } from 'react-native';

import {
  addPinnedLocation,
  loadPinnedLocations,
  loadRecentLocations,
  loadSavedLocation,
  removePinnedLocation,
  saveLocation,
  type RecentLocation,
  type SavedLocation,
} from '@/services/locationStorage';
import { getForecastSnapshot, type ForecastSnapshot } from '@/services/forecastSnapshot';
import { setMemoryCachedForecast } from '@/services/forecastCache';
import { DEFAULT_EXPOSURE_LEVEL, type ExposureLevel } from '@/types/settings';
import type { ForecastExtras } from '@/types/weather';

import { resolveDeviceLocation, setLastKnownDeviceLocation } from './device-location';
import { mergeExtrasWhenReady } from './merge-extras';

export interface ForecastState {
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

export const INITIAL_FORECAST_STATE: ForecastState = {
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

export type ForecastLoadResult =
  | { kind: 'needsLocation'; recentLocations: RecentLocation[]; pinnedLocations: RecentLocation[] }
  | {
      kind: 'loaded';
      snapshot: ForecastSnapshot;
      extras: Promise<ForecastExtras | null>;
      savedLocation: SavedLocation | null;
      recentLocations: RecentLocation[];
      pinnedLocations: RecentLocation[];
    };

export async function loadForecastData(
  locationOverride: SavedLocation | null | undefined,
  mockScenario: string | null,
  homeLocation: SavedLocation | null,
  exposureLevel: ExposureLevel = DEFAULT_EXPOSURE_LEVEL,
): Promise<ForecastLoadResult> {
  const [storedLocation, recentLocations, pinnedLocations] = await Promise.all([
    locationOverride === undefined ? loadSavedLocation() : Promise.resolve(locationOverride),
    loadRecentLocations(),
    loadPinnedLocations(),
  ]);

  let savedLocation = storedLocation;
  if (!mockScenario && !savedLocation) {
    if (Platform.OS === 'web') {
      return { kind: 'needsLocation', recentLocations, pinnedLocations };
    }
    savedLocation = await resolveDeviceLocation(true);
    if (!savedLocation) {
      return { kind: 'needsLocation', recentLocations, pinnedLocations };
    }
  }

  const { snapshot, extras } = await getForecastSnapshot({
    savedLocation,
    homeLocation,
    exposureLevel,
    mockScenario,
  });
  return { kind: 'loaded', snapshot, extras, savedLocation, recentLocations, pinnedLocations };
}

// Device locations are stored without a name; once reverse geocoding resolves
// one, persist it so later loads show the city immediately.
export function persistResolvedDeviceName(result: Extract<ForecastLoadResult, { kind: 'loaded' }>) {
  const { savedLocation, snapshot } = result;
  if (
    !snapshot.mockScenario &&
    savedLocation?.source === 'device' &&
    !savedLocation.name &&
    snapshot.location !== 'Your Location'
  ) {
    void saveLocation({ ...savedLocation, name: snapshot.location }).catch(() => {
      /* best-effort */
    });
  }
}

export async function togglePinnedLocation(
  place: RecentLocation,
  pinned: RecentLocation[],
): Promise<RecentLocation[]> {
  const pinnedNow = pinned.some((p) => p.lat === place.lat && p.lon === place.lon);
  return pinnedNow ? removePinnedLocation(place.lat, place.lon) : addPinnedLocation(place);
}

export function applyNeedsLocation(
  result: Extract<ForecastLoadResult, { kind: 'needsLocation' }>,
  setState: Dispatch<SetStateAction<ForecastState>>,
  needsLocationRef: { current: boolean },
): void {
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
}

export function applyForecastSuccess(
  result: Extract<ForecastLoadResult, { kind: 'loaded' }>,
  setState: Dispatch<SetStateAction<ForecastState>>,
  needsLocationRef: { current: boolean },
  lastLoadedAt: { current: number },
): void {
  persistResolvedDeviceName(result);
  lastLoadedAt.current = Date.now();
  needsLocationRef.current = false;
  if (result.savedLocation) {
    setMemoryCachedForecast(result.savedLocation, result.snapshot);
    if (result.savedLocation.source === 'device') {
      setLastKnownDeviceLocation(result.savedLocation);
    }
  }
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
  mergeExtrasWhenReady(result.snapshot, result.extras, setState);
}
