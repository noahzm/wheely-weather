import { describe, it, expect } from 'vitest';

import { resolveThresholds } from '../domain/acclimatization';
import { THRESHOLDS } from '../domain/constants';

import {
  FORECAST_CACHE_TTL_MS,
  decodeForecastCache,
  encodeForecastCache,
} from './forecastCacheCodec';
import type { ForecastSnapshot } from './forecastSnapshot';
import type { SavedLocation } from './locationStorage';
import { buildMockWeather } from './mockWeather';

const NOW = 1_750_000_000_000;
const LOCATION: SavedLocation = { lat: 45.5, lon: -122.6, name: 'Portland', source: 'manual' };
const GULF_BASELINE = { warmTemp: 95, warmDewpoint: 78 };

function buildSnapshot(overrides: Partial<ForecastSnapshot> = {}): ForecastSnapshot {
  const weather = buildMockWeather('ride');
  if (!weather) throw new Error('mock weather fixture missing');
  return {
    weather,
    location: 'Portland',
    lastUpdated: new Date(NOW),
    isManualLocation: true,
    isDeviceLocation: false,
    mockScenario: null,
    source: 'manual',
    acclimatization: { homeBaseline: null, thresholds: THRESHOLDS },
    ...overrides,
  };
}

describe('encodeForecastCache', () => {
  it('refuses to cache mock snapshots', () => {
    expect(encodeForecastCache(buildSnapshot({ mockScenario: 'ride' }), LOCATION)).toBeNull();
    expect(encodeForecastCache(buildSnapshot({ source: 'mock' }), LOCATION)).toBeNull();
  });

  it('produces valid JSON for live snapshots', () => {
    const encoded = encodeForecastCache(buildSnapshot(), LOCATION);
    expect(encoded).toBeTypeOf('string');
    const parsed: unknown = JSON.parse(encoded ?? 'null');
    expect(parsed).toBeTruthy();
  });
});

describe('decodeForecastCache', () => {
  it('round-trips a live snapshot', () => {
    const snapshot = buildSnapshot();
    const encoded = encodeForecastCache(snapshot, LOCATION);
    const decoded = decodeForecastCache(encoded, LOCATION, NOW + 1000);

    expect(decoded).not.toBeNull();
    expect(decoded?.savedLocation).toEqual(LOCATION);
    expect(decoded?.snapshot.location).toBe('Portland');
    expect(decoded?.snapshot.source).toBe('manual');
    expect(decoded?.snapshot.isManualLocation).toBe(true);
    expect(decoded?.snapshot.isDeviceLocation).toBe(false);
    expect(decoded?.snapshot.mockScenario).toBeNull();
    expect(decoded?.snapshot.weather.temperature).toBe(snapshot.weather.temperature);
    expect(decoded?.snapshot.weather.hourly).toHaveLength(snapshot.weather.hourly.length);
    expect(decoded?.snapshot.weather.daily).toHaveLength(snapshot.weather.daily.length);
  });

  it('revives lastUpdated as a Date preserving the fetch time', () => {
    const encoded = encodeForecastCache(buildSnapshot(), LOCATION);
    const decoded = decodeForecastCache(encoded, LOCATION, NOW + 1000);
    expect(decoded?.snapshot.lastUpdated).toBeInstanceOf(Date);
    expect(decoded?.snapshot.lastUpdated.getTime()).toBe(NOW);
  });

  it('rebuilds thresholds instead of deserializing them, keeping Infinity intact', () => {
    const withBaseline = buildSnapshot({
      acclimatization: {
        homeBaseline: GULF_BASELINE,
        thresholds: resolveThresholds(GULF_BASELINE),
      },
    });
    const decoded = decodeForecastCache(
      encodeForecastCache(withBaseline, LOCATION),
      LOCATION,
      NOW + 1000,
    );
    expect(decoded?.snapshot.acclimatization.homeBaseline).toEqual(GULF_BASELINE);
    expect(decoded?.snapshot.acclimatization.thresholds).toEqual(resolveThresholds(GULF_BASELINE));
    expect(decoded?.snapshot.acclimatization.thresholds.HUMIDITY.BAD).toBe(Infinity);

    const withoutBaseline = decodeForecastCache(
      encodeForecastCache(buildSnapshot(), LOCATION),
      LOCATION,
      NOW + 1000,
    );
    expect(withoutBaseline?.snapshot.acclimatization.thresholds).toEqual(THRESHOLDS);
    expect(withoutBaseline?.snapshot.acclimatization.thresholds.HUMIDITY.BAD).toBe(Infinity);
  });

  it('rejects entries older than the TTL or from the future', () => {
    const encoded = encodeForecastCache(buildSnapshot(), LOCATION);
    expect(decodeForecastCache(encoded, LOCATION, NOW + FORECAST_CACHE_TTL_MS)).not.toBeNull();
    expect(decodeForecastCache(encoded, LOCATION, NOW + FORECAST_CACHE_TTL_MS + 1)).toBeNull();
    expect(decodeForecastCache(encoded, LOCATION, NOW - 1)).toBeNull();
  });

  it('rejects a cache written for a different location', () => {
    const encoded = encodeForecastCache(buildSnapshot(), LOCATION);
    const elsewhere: SavedLocation = { ...LOCATION, lat: 40.7 };
    const otherSource: SavedLocation = { ...LOCATION, source: 'device' };
    expect(decodeForecastCache(encoded, elsewhere, NOW + 1000)).toBeNull();
    expect(decodeForecastCache(encoded, otherSource, NOW + 1000)).toBeNull();
    expect(decodeForecastCache(encoded, null, NOW + 1000)).toBeNull();
  });

  it('rejects missing, corrupt, or wrong-version payloads', () => {
    expect(decodeForecastCache(null, LOCATION, NOW)).toBeNull();
    expect(decodeForecastCache('not json{', LOCATION, NOW)).toBeNull();
    expect(decodeForecastCache('{"half": true}', LOCATION, NOW)).toBeNull();

    const encoded = encodeForecastCache(buildSnapshot(), LOCATION) ?? '';
    const tampered = JSON.stringify({
      ...(JSON.parse(encoded) as Record<string, unknown>),
      version: 99,
    });
    expect(decodeForecastCache(tampered, LOCATION, NOW + 1000)).toBeNull();
  });

  it('rejects a payload whose weather is truncated', () => {
    const encoded = encodeForecastCache(buildSnapshot(), LOCATION) ?? '';
    const parsed = JSON.parse(encoded) as Record<string, unknown>;
    const gutted = JSON.stringify({ ...parsed, weather: { temperature: 70 } });
    expect(decodeForecastCache(gutted, LOCATION, NOW + 1000)).toBeNull();
  });
});
