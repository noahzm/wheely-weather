import { beforeEach, describe, expect, it, vi } from 'vitest';

import { THRESHOLDS } from '../domain/constants';

import {
  clearMemoryCachedForecasts,
  getMemoryCachedForecast,
  loadCachedForecast,
  saveCachedForecast,
} from './forecastCache';
import type { ForecastSnapshot } from './forecastSnapshot';
import { buildMockWeather } from './mockWeather';
import type { SavedLocation } from './settingsCodec';

const { store, storage, captureError } = vi.hoisted(() => {
  const store = new Map<string, string>();
  const storage = {
    getItem: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
  };
  return { store, storage, captureError: vi.fn() };
});

vi.mock('@react-native-async-storage/async-storage', () => ({ default: storage }));
vi.mock('./telemetry', () => ({ captureError }));

const CACHE_KEY = 'ww_forecast_snapshot';
const PORTLAND: SavedLocation = { lat: 45.5, lon: -122.6, name: 'Portland', source: 'manual' };
const RALEIGH: SavedLocation = { lat: 35.78, lon: -78.64, name: 'Raleigh', source: 'manual' };

function buildSnapshot(overrides: Partial<ForecastSnapshot> = {}): ForecastSnapshot {
  const weather = buildMockWeather('ride');
  if (!weather) throw new Error('mock weather fixture missing');
  return {
    weather,
    location: 'Portland',
    lastUpdated: new Date(),
    isManualLocation: true,
    isDeviceLocation: false,
    mockScenario: null,
    source: 'manual',
    acclimatization: { homeBaseline: null, thresholds: THRESHOLDS, exposureLevel: 'moderate' },
    ...overrides,
  };
}

const storeActiveLocation = (location: SavedLocation) => {
  store.set('ww_location', JSON.stringify({ version: 1, ...location }));
};

beforeEach(() => {
  store.clear();
  clearMemoryCachedForecasts();
  vi.clearAllMocks();
});

describe('saveCachedForecast', () => {
  it('writes to disk and to the memory cache', async () => {
    await saveCachedForecast(buildSnapshot(), PORTLAND);

    expect(store.has(CACHE_KEY)).toBe(true);
    expect(getMemoryCachedForecast(PORTLAND)?.snapshot.location).toBe('Portland');
  });

  it('never persists mock snapshots', async () => {
    await saveCachedForecast(buildSnapshot({ mockScenario: 'ride', source: 'mock' }), PORTLAND);

    expect(store.has(CACHE_KEY)).toBe(false);
    expect(getMemoryCachedForecast(PORTLAND)).toBeNull();
  });

  it('reports a failed write without throwing', async () => {
    storage.setItem.mockRejectedValueOnce(new Error('disk full'));
    await expect(saveCachedForecast(buildSnapshot(), PORTLAND)).resolves.toBeUndefined();
    expect(captureError).toHaveBeenCalledWith(expect.anything(), { where: 'saveCachedForecast' });
  });
});

describe('loadCachedForecast', () => {
  it('returns the cached snapshot for the active location and warms the memory cache', async () => {
    await saveCachedForecast(buildSnapshot(), PORTLAND);
    clearMemoryCachedForecasts();
    storeActiveLocation(PORTLAND);

    const cached = await loadCachedForecast();

    expect(cached?.savedLocation).toEqual(PORTLAND);
    expect(cached?.snapshot.location).toBe('Portland');
    expect(getMemoryCachedForecast(PORTLAND)).not.toBeNull();
  });

  it('misses when the cache was written for a different location', async () => {
    await saveCachedForecast(buildSnapshot(), PORTLAND);
    storeActiveLocation(RALEIGH);

    await expect(loadCachedForecast()).resolves.toBeNull();
  });

  it('misses when nothing is cached or no location is saved', async () => {
    await expect(loadCachedForecast()).resolves.toBeNull();

    await saveCachedForecast(buildSnapshot(), PORTLAND);
    await expect(loadCachedForecast()).resolves.toBeNull();
  });

  it('reads a storage failure as a miss and reports it', async () => {
    store.set('ww_location', '{corrupt');

    await expect(loadCachedForecast()).resolves.toBeNull();
    expect(captureError).toHaveBeenCalledWith(expect.anything(), { where: 'loadCachedForecast' });
  });
});
