import { describe, it, expect, beforeEach } from 'vitest';

import { THRESHOLDS } from '../domain/constants';

import {
  clearMemoryCachedForecasts,
  getMemoryCacheVersion,
  getMemoryCachedForecast,
  getSnapshotLocationKey,
  isSnapshotForSettings,
  setMemoryCachedForecast,
  subscribeMemoryCache,
} from './snapshotMemoryCache';
import type { ForecastSnapshot } from './forecastSnapshot';
import { buildMockWeather } from './mockWeather';
import type { SavedLocation } from './settingsCodec';

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
    // Fresh by default: entries age from fetch time.
    lastUpdated: new Date(),
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

  it('ages entries from fetch time, not from when they were cached', () => {
    // Re-caching an old snapshot (disk hydration, extras merge) must not restart its TTL.
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
    setMemoryCachedForecast(PORTLAND, buildSnapshot('Portland', { lastUpdated: fiveHoursAgo }));

    expect(getMemoryCachedForecast(PORTLAND, 6 * 60 * 60 * 1000)).not.toBeNull();
    expect(getMemoryCachedForecast(PORTLAND, 4 * 60 * 60 * 1000)).toBeNull();
  });

  it('clears all memory entries on clearMemoryCachedForecasts', () => {
    setMemoryCachedForecast(PORTLAND, buildSnapshot('Portland'));
    setMemoryCachedForecast(RALEIGH, buildSnapshot('Raleigh'));

    clearMemoryCachedForecasts();

    expect(getMemoryCachedForecast(PORTLAND)).toBeNull();
    expect(getMemoryCachedForecast(RALEIGH)).toBeNull();
  });

  it('matches cached snapshots against active settings', () => {
    const snap = buildSnapshot('Portland', {
      rideDuration: '4h',
      acclimatization: {
        homeBaseline: null,
        thresholds: THRESHOLDS,
        exposureLevel: 'high',
        homeLocation: RALEIGH,
      },
    });
    setMemoryCachedForecast(PORTLAND, snap);

    expect(
      getMemoryCachedForecast(PORTLAND, undefined, {
        rideDuration: '4h',
        exposureLevel: 'high',
        homeLocation: { lat: RALEIGH.lat, lon: RALEIGH.lon },
      }),
    ).not.toBeNull();
    expect(getMemoryCachedForecast(PORTLAND, undefined, { rideDuration: '2h' })).toBeNull();
    expect(getMemoryCachedForecast(PORTLAND, undefined, { exposureLevel: 'indoor' })).toBeNull();
    expect(getMemoryCachedForecast(PORTLAND, undefined, { homeLocation: PORTLAND })).toBeNull();
    expect(getMemoryCachedForecast(PORTLAND, undefined, { homeLocation: null })).toBeNull();
    expect(isSnapshotForSettings(snap)).toBe(true);
  });

  it('notifies subscribers when entries are added, expired, or cleared', () => {
    let notifications = 0;
    const unsubscribe = subscribeMemoryCache(() => {
      notifications += 1;
    });
    const startVersion = getMemoryCacheVersion();

    // Clearing an empty cache is a no-op.
    clearMemoryCachedForecasts();
    expect(notifications).toBe(0);

    setMemoryCachedForecast(PORTLAND, buildSnapshot('Portland'));
    expect(notifications).toBe(1);
    expect(getMemoryCacheVersion()).toBe(startVersion + 1);

    // Expiring an entry evicts and notifies.
    expect(getMemoryCachedForecast(PORTLAND, -1)).toBeNull();
    expect(notifications).toBe(2);

    unsubscribe();
    setMemoryCachedForecast(RALEIGH, buildSnapshot('Raleigh'));
    expect(notifications).toBe(2);
  });
});
