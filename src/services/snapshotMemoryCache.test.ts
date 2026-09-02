import { describe, it, expect, beforeEach } from 'vitest';

import { THRESHOLDS } from '../domain/constants';

import {
  clearMemoryCachedForecasts,
  getMemoryCachedForecast,
  getSnapshotLocationKey,
  setMemoryCachedForecast,
} from './snapshotMemoryCache';
import type { ForecastSnapshot } from './forecastSnapshot';
import { buildMockWeather } from './mockWeather';
import type { SavedLocation } from './settingsCodec';

const NOW = 1_750_000_000_000;
const PORTLAND: SavedLocation = { lat: 45.5, lon: -122.6, name: 'Portland', source: 'manual' };
const RALEIGH: SavedLocation = { lat: 35.78, lon: -78.64, name: 'Raleigh', source: 'manual' };

function buildSnapshot(
  locationName: string,
  overrides: Partial<ForecastSnapshot> = {},
): ForecastSnapshot {
  const weather = buildMockWeather('ride');
  if (!weather) throw new Error('mock weather fixture missing');
  return {
    weather,
    location: locationName,
    lastUpdated: new Date(NOW),
    isManualLocation: true,
    isDeviceLocation: false,
    mockScenario: null,
    source: 'manual',
    acclimatization: { homeBaseline: null, thresholds: THRESHOLDS, exposureLevel: 'moderate' },
    ...overrides,
  };
}

describe('snapshotMemoryCache', () => {
  beforeEach(() => {
    clearMemoryCachedForecasts();
  });

  it('generates consistent location keys based on rounded coordinates', () => {
    expect(getSnapshotLocationKey({ lat: 35.7796, lon: -78.6382 })).toBe('35.780,-78.638');
    expect(getSnapshotLocationKey({ lat: 35.7801, lon: -78.6384 })).toBe('35.780,-78.638');
  });

  it('stores and retrieves snapshots for different locations', () => {
    const portlandSnap = buildSnapshot('Portland');
    const raleighSnap = buildSnapshot('Raleigh');

    setMemoryCachedForecast(PORTLAND, portlandSnap);
    setMemoryCachedForecast(RALEIGH, raleighSnap);

    const portlandCached = getMemoryCachedForecast(PORTLAND);
    const raleighCached = getMemoryCachedForecast(RALEIGH);

    expect(portlandCached?.snapshot.location).toBe('Portland');
    expect(raleighCached?.snapshot.location).toBe('Raleigh');
  });

  it('returns null on cache miss', () => {
    expect(getMemoryCachedForecast({ lat: 10, lon: 20 })).toBeNull();
  });

  it('does not cache mock scenarios under coordinates', () => {
    const mockSnap = buildSnapshot('Mock', { mockScenario: 'ride' });
    setMemoryCachedForecast(PORTLAND, mockSnap);
    expect(getMemoryCachedForecast(PORTLAND)).toBeNull();
  });

  it('expires entries older than maxAgeMs', () => {
    const snap = buildSnapshot('Portland');
    setMemoryCachedForecast(PORTLAND, snap);

    // Expired with maxAgeMs = -1
    expect(getMemoryCachedForecast(PORTLAND, -1)).toBeNull();
  });

  it('clears all memory entries on clearMemoryCachedForecasts', () => {
    setMemoryCachedForecast(PORTLAND, buildSnapshot('Portland'));
    setMemoryCachedForecast(RALEIGH, buildSnapshot('Raleigh'));

    clearMemoryCachedForecasts();

    expect(getMemoryCachedForecast(PORTLAND)).toBeNull();
    expect(getMemoryCachedForecast(RALEIGH)).toBeNull();
  });
});
