import {
  DEFAULT_NIGHT_RIDING,
  DEFAULT_RIDE_DURATION,
  type ExposureLevel,
  type RideDuration,
} from '@/types/settings';

import type { ForecastSnapshot } from './forecastSnapshot';
import { FORECAST_CACHE_TTL_MS, type CachedForecast } from './forecastCacheCodec';
import type { SavedLocation } from './settingsCodec';

export interface ForecastCacheSettings {
  homeLocation?: { lat: number; lon: number } | null;
  exposureLevel?: ExposureLevel;
  rideDuration?: RideDuration;
  nightRiding?: boolean;
}

const memorySnapshotCache = new Map<string, CachedForecast & { timestamp: number }>();
const listeners = new Set<() => void>();
let cacheVersion = 0;

function notifyListeners(): void {
  cacheVersion += 1;
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeMemoryCache(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getMemoryCacheVersion(): number {
  return cacheVersion;
}

export function getSnapshotLocationKey(location: { lat: number; lon: number }): string {
  return `${location.lat.toFixed(3)},${location.lon.toFixed(3)}`;
}

function sameCoordinates(
  a: { lat: number; lon: number } | null,
  b: { lat: number; lon: number } | null,
): boolean {
  if (a === null || b === null) return a === b;
  return getSnapshotLocationKey(a) === getSnapshotLocationKey(b);
}

/**
 * Checks whether a cached snapshot was rated under the given settings, so a
 * change to ride length, exposure level, or home climate forces a cache miss.
 */
export function isSnapshotForSettings(
  snapshot: ForecastSnapshot,
  settings?: ForecastCacheSettings,
): boolean {
  if (!settings) return true;
  if (
    settings.exposureLevel !== undefined &&
    snapshot.acclimatization.exposureLevel !== settings.exposureLevel
  ) {
    return false;
  }
  if (
    settings.rideDuration !== undefined &&
    (snapshot.rideDuration ?? DEFAULT_RIDE_DURATION) !== settings.rideDuration
  ) {
    return false;
  }
  if (
    settings.nightRiding !== undefined &&
    (snapshot.nightRiding ?? DEFAULT_NIGHT_RIDING) !== settings.nightRiding
  ) {
    return false;
  }
  if (
    settings.homeLocation !== undefined &&
    !sameCoordinates(snapshot.acclimatization.homeLocation ?? null, settings.homeLocation)
  ) {
    return false;
  }
  return true;
}

export function getMemoryCachedForecast(
  location: { lat: number; lon: number },
  maxAgeMs = FORECAST_CACHE_TTL_MS,
  settings?: ForecastCacheSettings,
): CachedForecast | null {
  const key = getSnapshotLocationKey(location);
  const entry = memorySnapshotCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > maxAgeMs) {
    memorySnapshotCache.delete(key);
    notifyListeners();
    return null;
  }
  if (!isSnapshotForSettings(entry.snapshot, settings)) return null;
  return { snapshot: entry.snapshot, savedLocation: entry.savedLocation };
}

export function setMemoryCachedForecast(
  savedLocation: SavedLocation,
  snapshot: ForecastSnapshot,
): void {
  if (snapshot.mockScenario !== null) return;
  const key = getSnapshotLocationKey(savedLocation);
  memorySnapshotCache.set(key, {
    snapshot,
    savedLocation,
    // Age from fetch time, not write time: re-caching an already-shown snapshot
    // (disk hydration, extras merge) must not restart its TTL.
    timestamp: snapshot.lastUpdated.getTime(),
  });
  notifyListeners();
}

export function clearMemoryCachedForecasts(): void {
  if (memorySnapshotCache.size === 0) return;
  memorySnapshotCache.clear();
  notifyListeners();
}
