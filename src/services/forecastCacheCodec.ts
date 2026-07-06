import { resolveThresholds } from '../domain/acclimatization';

import type { HomeBaseline, Weather } from '@/types/weather';

import type { ForecastSnapshot } from './forecastSnapshot';
import type { LocationSource, SavedLocation } from './locationStorage';

export const FORECAST_CACHE_VERSION = 1;
// Cached content is only a bridge until the background refresh lands; when
// offline, 6h-old data still beats a spinner, but older than that the "Now"
// marker and hourly window drift too far to trust.
export const FORECAST_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export interface CachedForecast {
  snapshot: ForecastSnapshot;
  savedLocation: SavedLocation;
}

interface ForecastCachePayload {
  version: number;
  fetchedAt: number;
  location: SavedLocation;
  locationName: string;
  source: Exclude<ForecastSnapshot['source'], 'mock'>;
  homeBaseline: HomeBaseline | null;
  weather: Weather;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isLocationSource = (value: unknown): value is LocationSource =>
  value === 'manual' || value === 'device';

function isSavedLocation(value: unknown): value is SavedLocation {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    isFiniteNumber(record.lat) &&
    isFiniteNumber(record.lon) &&
    isLocationSource(record.source) &&
    (record.name === null || typeof record.name === 'string')
  );
}

function isHomeBaseline(value: unknown): value is HomeBaseline | null {
  if (value === null) return true;
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return isFiniteNumber(record.warmTemp) && isFiniteNumber(record.warmDewpoint);
}

// Spot-checks the fields the UI reads unconditionally; the version key guards
// against schema drift, so this only needs to reject truncated/corrupt payloads.
function isWeatherShape(value: unknown): value is Weather {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    isFiniteNumber(record.temperature) &&
    isFiniteNumber(record.feelsLike) &&
    isFiniteNumber(record.windSpeed) &&
    typeof record.condition === 'string' &&
    Array.isArray(record.hourly) &&
    Array.isArray(record.pastHourly) &&
    Array.isArray(record.daily)
  );
}

function isForecastCachePayload(value: unknown): value is ForecastCachePayload {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    record.version === FORECAST_CACHE_VERSION &&
    isFiniteNumber(record.fetchedAt) &&
    isSavedLocation(record.location) &&
    typeof record.locationName === 'string' &&
    isLocationSource(record.source) &&
    isHomeBaseline(record.homeBaseline) &&
    isWeatherShape(record.weather)
  );
}

const sameLocation = (a: SavedLocation, b: SavedLocation) =>
  a.lat === b.lat && a.lon === b.lon && a.source === b.source;

/**
 * Serializes a snapshot for caching. Returns null for mock snapshots (never
 * cached). Thresholds are intentionally NOT serialized: they contain Infinity
 * (JSON.stringify turns it into null) and are cheap to rebuild from the
 * baseline on decode.
 */
export function encodeForecastCache(
  snapshot: ForecastSnapshot,
  savedLocation: SavedLocation,
): string | null {
  if (snapshot.mockScenario !== null || snapshot.source === 'mock') return null;
  const payload: ForecastCachePayload = {
    version: FORECAST_CACHE_VERSION,
    fetchedAt: snapshot.lastUpdated.getTime(),
    location: savedLocation,
    locationName: snapshot.location,
    source: snapshot.source,
    homeBaseline: snapshot.acclimatization.homeBaseline,
    weather: snapshot.weather,
  };
  return JSON.stringify(payload);
}

/**
 * Parses a cached payload back into a snapshot, returning null for anything
 * not worth showing: corrupt JSON, wrong version, expired or future-dated
 * entries, or a cache written for a different location than the current one.
 */
export function decodeForecastCache(
  raw: string | null,
  currentLocation: SavedLocation | null,
  now: number = Date.now(),
): CachedForecast | null {
  if (!raw || !currentLocation) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isForecastCachePayload(parsed)) return null;

  const age = now - parsed.fetchedAt;
  if (age < 0 || age > FORECAST_CACHE_TTL_MS) return null;
  if (!sameLocation(parsed.location, currentLocation)) return null;

  const { homeBaseline } = parsed;
  return {
    savedLocation: parsed.location,
    snapshot: {
      weather: parsed.weather,
      location: parsed.locationName,
      lastUpdated: new Date(parsed.fetchedAt),
      isManualLocation: parsed.source === 'manual',
      isDeviceLocation: parsed.source === 'device',
      mockScenario: null,
      source: parsed.source,
      acclimatization: { homeBaseline, thresholds: resolveThresholds(homeBaseline) },
    },
  };
}
