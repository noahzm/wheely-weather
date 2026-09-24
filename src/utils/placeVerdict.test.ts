import { beforeEach, describe, expect, it } from 'vitest';

import { THRESHOLDS } from '@/domain';
import type { ForecastSnapshot } from '@/services/forecastSnapshot';
import { buildMockWeather } from '@/services/mockWeather';
import {
  clearMemoryCachedForecasts,
  setMemoryCachedForecast,
} from '@/services/snapshotMemoryCache';
import type { SavedLocation } from '@/services/settingsCodec';

import { getCachedPlaceVerdict } from './placeVerdict';

const RALEIGH: SavedLocation = { lat: 35.78, lon: -78.64, name: 'Raleigh', source: 'manual' };

function cache(scenario: string): void {
  const weather = buildMockWeather(scenario);
  if (!weather) throw new Error(`mock weather fixture missing: ${scenario}`);
  const snapshot: ForecastSnapshot = {
    weather,
    location: 'Raleigh',
    lastUpdated: new Date(),
    isManualLocation: true,
    isDeviceLocation: false,
    mockScenario: null,
    source: 'manual',
    acclimatization: { homeBaseline: null, thresholds: THRESHOLDS, exposureLevel: 'moderate' },
  };
  setMemoryCachedForecast(RALEIGH, snapshot);
}

describe('getCachedPlaceVerdict', () => {
  beforeEach(() => {
    clearMemoryCachedForecasts();
  });

  it('is null for a place with no cached forecast', () => {
    expect(getCachedPlaceVerdict(RALEIGH, 'fahrenheit')).toBeNull();
  });

  it('summarizes a cached ride day', () => {
    cache('ride');
    const verdict = getCachedPlaceVerdict(RALEIGH, 'fahrenheit');
    expect(verdict).toMatchObject({ waiting: false });
    expect(verdict?.label.length).toBeGreaterThan(0);
    expect(['good', 'fair']).toContain(verdict?.condition);
  });

  it('flags the wait state so the row can show it in pink', () => {
    cache('wait');
    const verdict = getCachedPlaceVerdict(RALEIGH, 'fahrenheit');
    expect(verdict?.waiting).toBe(true);
    expect(verdict?.label).toMatch(/(AM|PM)$/);
  });
});
