import { beforeEach, describe, expect, it, vi } from 'vitest';

import { THRESHOLDS } from '@/domain';
import type { HomeBaseline } from '@/services/homeClimate';
import type { SavedLocation } from '@/services/locationStorage';
import { REQUEST_TIMEOUT_ERROR, type OpenMeteoData } from '@/services/weatherService';
import { makeWeather } from '@/test-utils/weather';

const mocks = vi.hoisted(() => ({
  fetchOpenMeteoData: vi.fn(),
  fetchWeatherExtras: vi.fn(),
  buildWeatherFromData: vi.fn(),
  fetchLocationName: vi.fn(),
  getHomeBaseline: vi.fn(),
}));

vi.mock('@/services/weatherService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/weatherService')>();
  return {
    ...actual,
    fetchOpenMeteoData: mocks.fetchOpenMeteoData,
    fetchWeatherExtras: mocks.fetchWeatherExtras,
    buildWeatherFromData: mocks.buildWeatherFromData,
  };
});

vi.mock('@/services/locationGeocoding', () => ({
  fetchLocationName: mocks.fetchLocationName,
}));

vi.mock('@/services/homeClimate', () => ({
  getHomeBaseline: mocks.getHomeBaseline,
}));

const { getForecastErrorKind, getForecastSnapshot } = await import('./forecastSnapshot');

const RALEIGH_MANUAL: SavedLocation = {
  lat: 35.78,
  lon: -78.64,
  name: 'Raleigh, NC',
  source: 'manual',
};

const DEVICE_UNNAMED: SavedLocation = {
  lat: 35.78,
  lon: -78.64,
  name: null,
  source: 'device',
};

const PAYLOAD = { utc_offset_seconds: 0 } as OpenMeteoData;
const WEATHER = makeWeather({ temperature: 70 });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.fetchOpenMeteoData.mockResolvedValue(PAYLOAD);
  mocks.fetchWeatherExtras.mockResolvedValue({ aqi: 28, nwsAlerts: [] });
  mocks.buildWeatherFromData.mockReturnValue(WEATHER);
  mocks.fetchLocationName.mockResolvedValue('Durham, NC');
  mocks.getHomeBaseline.mockResolvedValue(null);
});

describe('getForecastSnapshot — mock scenarios', () => {
  it('returns a mock snapshot pinned to base thresholds without touching the network', async () => {
    const { snapshot, extras } = await getForecastSnapshot({
      savedLocation: RALEIGH_MANUAL,
      mockScenario: 'ride',
      rideDuration: '5h',
    });

    expect(snapshot).toMatchObject({
      location: 'Mock: Ride Day',
      isManualLocation: false,
      isDeviceLocation: false,
      mockScenario: 'ride',
      source: 'mock',
      rideDuration: '5h',
      acclimatization: {
        homeBaseline: null,
        thresholds: THRESHOLDS,
        exposureLevel: 'moderate',
        homeLocation: null,
      },
    });
    await expect(extras).resolves.toBeNull();
    expect(mocks.fetchOpenMeteoData).not.toHaveBeenCalled();
    expect(mocks.fetchWeatherExtras).not.toHaveBeenCalled();
  });

  it('throws on an unknown mock scenario', async () => {
    await expect(
      getForecastSnapshot({ savedLocation: null, mockScenario: 'unknown-scenario' }),
    ).rejects.toThrow('Unknown mock scenario: unknown-scenario');
  });
});

describe('getForecastSnapshot — live locations', () => {
  it('requires a location when not in mock mode', async () => {
    await expect(getForecastSnapshot({ savedLocation: null })).rejects.toThrow('Location required');
  });

  it('uses a saved manual location name without reverse-geocoding', async () => {
    const baseline: HomeBaseline = { warmTemp: 90, warmDewpoint: 70, coolTemp: 55 };
    mocks.getHomeBaseline.mockResolvedValue(baseline);

    const { snapshot, extras } = await getForecastSnapshot({
      savedLocation: RALEIGH_MANUAL,
      homeLocation: RALEIGH_MANUAL,
      exposureLevel: 'high',
    });

    expect(mocks.fetchLocationName).not.toHaveBeenCalled();
    expect(mocks.buildWeatherFromData).toHaveBeenCalledWith(
      PAYLOAD,
      expect.objectContaining({
        TEMPERATURE: expect.objectContaining({
          FAIR_MAX: expect.any(Number) as number,
        }) as unknown,
      }),
      3,
    );
    expect(snapshot).toMatchObject({
      weather: WEATHER,
      location: 'Raleigh, NC',
      isManualLocation: true,
      isDeviceLocation: false,
      mockScenario: null,
      source: 'manual',
      forecastData: PAYLOAD,
      acclimatization: {
        homeBaseline: baseline,
        exposureLevel: 'high',
        homeLocation: { lat: RALEIGH_MANUAL.lat, lon: RALEIGH_MANUAL.lon },
      },
    });
    await expect(extras).resolves.toEqual({ aqi: 28, nwsAlerts: [] });
  });

  it('reverse-geocodes an unnamed device location and falls back to "Your Location"', async () => {
    const named = await getForecastSnapshot({ savedLocation: DEVICE_UNNAMED });
    expect(mocks.fetchLocationName).toHaveBeenCalledWith(35.78, -78.64);
    expect(named.snapshot.location).toBe('Durham, NC');
    expect(named.snapshot.isDeviceLocation).toBe(true);

    mocks.fetchLocationName.mockResolvedValueOnce(null);
    const nullFallback = await getForecastSnapshot({ savedLocation: DEVICE_UNNAMED });
    expect(nullFallback.snapshot.location).toBe('Your Location');

    mocks.fetchLocationName.mockRejectedValueOnce(new Error('Reverse geocode failed'));
    const errorFallback = await getForecastSnapshot({ savedLocation: DEVICE_UNNAMED });
    expect(errorFallback.snapshot.location).toBe('Your Location');
  });

  it('resolves extras to empty defaults when fetchWeatherExtras rejects', async () => {
    mocks.fetchWeatherExtras.mockRejectedValueOnce(new Error('NWS outage'));

    const { extras } = await getForecastSnapshot({ savedLocation: RALEIGH_MANUAL });

    await expect(extras).resolves.toEqual({ aqi: null, nwsAlerts: [] });
  });
});

describe('getForecastErrorKind', () => {
  it('classifies fetch TypeErrors and request timeouts as network errors', () => {
    expect(getForecastErrorKind(new TypeError('Network request failed'))).toBe('network');
    expect(getForecastErrorKind(new Error(REQUEST_TIMEOUT_ERROR))).toBe('network');
  });

  it('classifies other errors and non-errors as default', () => {
    expect(getForecastErrorKind(new Error('Weather API error: 500'))).toBe('default');
    expect(getForecastErrorKind('unexpected')).toBe('default');
    expect(getForecastErrorKind(null)).toBe('default');
  });
});
