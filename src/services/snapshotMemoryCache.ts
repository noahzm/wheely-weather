import type { ForecastSnapshot } from './forecastSnapshot';
import { FORECAST_CACHE_TTL_MS, type CachedForecast } from './forecastCacheCodec';
import type { SavedLocation } from './settingsCodec';

const memorySnapshotCache = new Map<string, CachedForecast & { timestamp: number }>();

export function getSnapshotLocationKey(location: { lat: number; lon: number }): string {
  return `${location.lat.toFixed(3)},${location.lon.toFixed(3)}`;
}

export function getMemoryCachedForecast(
  location: { lat: number; lon: number },
  maxAgeMs = FORECAST_CACHE_TTL_MS,
): CachedForecast | null {
  const key = getSnapshotLocationKey(location);
  const entry = memorySnapshotCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > maxAgeMs) {
    memorySnapshotCache.delete(key);
    return null;
  }
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
    timestamp: Date.now(),
  });
}

export function clearMemoryCachedForecasts(): void {
  memorySnapshotCache.clear();
}
