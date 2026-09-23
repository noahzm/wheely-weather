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
import { saveCachedForecast } from '@/services/forecastCache';
import { DEFAULT_EXPOSURE_LEVEL, type ExposureLevel } from '@/types/settings';
import type { ForecastExtras } from '@/types/weather';

import {
  refreshFollowedLocation,
  resolveDeviceLocation,
  setLastKnownDeviceLocation,
} from './device-location';
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

type ForecastLoadResult =
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
  // Following the device: if iOS already knows we've moved since the fix was
  // saved (e.g. a cold launch in another town), load there directly instead of
  // loading the old spot and letting the watch correct it a moment later.
  // Explicit overrides are already fresh, and mocks never touch location.
  if (!mockScenario && locationOverride === undefined) {
    savedLocation =
      (await refreshFollowedLocation(savedLocation, { allowGps: false })) ?? savedLocation;
  }
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
  isLatestLoad: () => boolean = () => true,
): void {
  persistResolvedDeviceName(result);
  lastLoadedAt.current = Date.now();
  needsLocationRef.current = false;
  // Cache here, where the snapshot is known to belong to `savedLocation`. A
  // state-watching effect saw transient pairs (new location, previous place's
  // snapshot) while a location switch was loading, and a failed fetch left
  // that mismatch cached under the new coordinates.
  const { savedLocation } = result;
  if (savedLocation) {
    void saveCachedForecast(result.snapshot, savedLocation);
    if (savedLocation.source === 'device') {
      setLastKnownDeviceLocation(savedLocation);
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
  mergeExtrasWhenReady(result.snapshot, result.extras, setState, (merged) => {
    // A newer load owns the cache by now; don't overwrite it with this one.
    if (savedLocation && isLatestLoad()) void saveCachedForecast(merged, savedLocation);
  });
}
