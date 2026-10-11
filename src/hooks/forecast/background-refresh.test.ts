import { beforeEach, describe, expect, it, vi } from 'vitest';

import { THRESHOLDS } from '../../domain/constants';
import { buildMockWeather } from '../../services/mockWeather';
import { formatTemperature } from '../../utils/temperature';

import type { ForecastSnapshot } from '@/services/forecastSnapshot';
import type { SavedLocation } from '@/services/locationStorage';
import type { ForecastExtras } from '@/types/weather';

const mocks = vi.hoisted(() => ({
  loadAllSettings: vi.fn(),
  loadSavedLocation: vi.fn(),
  loadCachedForecast: vi.fn(),
  saveCachedForecast: vi.fn<(snapshot: ForecastSnapshot, place: SavedLocation) => Promise<void>>(),
  getForecastSnapshot: vi.fn(),
  publishWidgetSnapshot: vi.fn(),
  getLocales: vi.fn(() => [{ temperatureUnit: 'celsius' }]),
}));

vi.mock('@/services/locationStorage', () => ({
  loadAllSettings: mocks.loadAllSettings,
  loadSavedLocation: mocks.loadSavedLocation,
}));
vi.mock('@/services/forecastCache', () => ({
  loadCachedForecast: mocks.loadCachedForecast,
  saveCachedForecast: mocks.saveCachedForecast,
}));
vi.mock('@/services/forecastSnapshot', () => ({ getForecastSnapshot: mocks.getForecastSnapshot }));
vi.mock('@/services/widgetStorage', () => ({ publishWidgetSnapshot: mocks.publishWidgetSnapshot }));
vi.mock('expo-localization', () => ({ getLocales: mocks.getLocales }));

const { BACKGROUND_REFRESH_MIN_AGE_MS, refreshWidgetInBackground } =
  await import('./background-refresh');

const NOW = Date.parse('2026-10-11T15:00:00Z');
const PLACE: SavedLocation = { lat: 35.99, lon: -78.9, name: 'Durham, NC', source: 'device' };
const HOME: SavedLocation = { lat: 35.78, lon: -78.64, name: 'Raleigh, NC', source: 'manual' };

function snapshotAt(time: number): ForecastSnapshot {
  const weather = buildMockWeather('ride');
  if (!weather) throw new Error('mock weather fixture missing');
  return {
    weather,
    location: 'Durham, NC',
    lastUpdated: new Date(time),
    isManualLocation: false,
    isDeviceLocation: true,
    mockScenario: null,
    source: 'device',
    acclimatization: { homeBaseline: null, thresholds: THRESHOLDS, exposureLevel: 'moderate' },
  };
}

function settings(tempUnit = 'auto') {
  return { homeLocation: HOME, exposureLevel: 'high', tempUnit };
}

const EXTRAS: ForecastExtras = { aqi: 42, nwsAlerts: [] };

function stubFetch(extras: ForecastExtras | null = EXTRAS) {
  const snapshot = snapshotAt(NOW);
  mocks.getForecastSnapshot.mockResolvedValue({ snapshot, extras: Promise.resolve(extras) });
  return snapshot;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadAllSettings.mockResolvedValue(settings());
  mocks.loadSavedLocation.mockResolvedValue(PLACE);
  mocks.loadCachedForecast.mockResolvedValue(null);
});

describe('refreshWidgetInBackground', () => {
  it('does nothing before a place has been chosen', async () => {
    mocks.loadSavedLocation.mockResolvedValue(null);
    await expect(refreshWidgetInBackground(NOW)).resolves.toBe('no-location');
    expect(mocks.getForecastSnapshot).not.toHaveBeenCalled();
  });

  it('leaves a recent forecast alone', async () => {
    const recent = NOW - BACKGROUND_REFRESH_MIN_AGE_MS + 60_000;
    mocks.loadCachedForecast.mockResolvedValue({
      snapshot: snapshotAt(recent),
      savedLocation: PLACE,
    });
    await expect(refreshWidgetInBackground(NOW)).resolves.toBe('fresh');
    expect(mocks.getForecastSnapshot).not.toHaveBeenCalled();
    expect(mocks.publishWidgetSnapshot).not.toHaveBeenCalled();
  });

  it('fetches with the rider’s settings, then caches and publishes the complete forecast', async () => {
    mocks.loadCachedForecast.mockResolvedValue({
      snapshot: snapshotAt(NOW - 2 * 60 * 60 * 1000),
      savedLocation: PLACE,
    });
    stubFetch();

    await expect(refreshWidgetInBackground(NOW)).resolves.toBe('refreshed');

    expect(mocks.getForecastSnapshot).toHaveBeenCalledWith({
      savedLocation: PLACE,
      homeLocation: HOME,
      exposureLevel: 'high',
    });
    // Cached with the extras merged in, under the place it was fetched for.
    const [cachedSnapshot, cachedPlace] = mocks.saveCachedForecast.mock.calls[0] ?? [];
    expect(cachedSnapshot?.weather.aqi).toBe(42);
    expect(cachedPlace).toBe(PLACE);
    expect(mocks.publishWidgetSnapshot).toHaveBeenCalledTimes(1);
  });

  it('resolves the "auto" unit from the locale, and keeps an explicit one', async () => {
    const { temperature } = stubFetch().weather;
    await refreshWidgetInBackground(NOW);
    expect(mocks.publishWidgetSnapshot.mock.calls[0]?.[0]).toMatchObject({
      temperature: formatTemperature(temperature, 'celsius'),
    });

    mocks.loadAllSettings.mockResolvedValue(settings('fahrenheit'));
    stubFetch();
    await refreshWidgetInBackground(NOW);
    expect(mocks.publishWidgetSnapshot.mock.calls[1]?.[0]).toMatchObject({
      temperature: formatTemperature(temperature, 'fahrenheit'),
    });
  });

  it('still publishes when the extras come back empty', async () => {
    const snapshot = stubFetch(null);
    await refreshWidgetInBackground(NOW);
    expect(mocks.saveCachedForecast.mock.calls[0]?.[0]).toBe(snapshot);
    expect(mocks.publishWidgetSnapshot).toHaveBeenCalledTimes(1);
  });

  it('rejects when the forecast fetch fails, so the task reports a failure', async () => {
    mocks.getForecastSnapshot.mockRejectedValue(new Error('WeatherKit 503'));
    await expect(refreshWidgetInBackground(NOW)).rejects.toThrow('WeatherKit 503');
    expect(mocks.publishWidgetSnapshot).not.toHaveBeenCalled();
  });
});
