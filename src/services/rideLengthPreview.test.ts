import { afterEach, describe, expect, it, vi } from 'vitest';
import { THRESHOLDS } from '@/domain';
import { buildMockWeather } from './mockWeather';
import { previewRideLength } from './rideLengthPreview';
import type { ForecastSnapshot } from './forecastSnapshot';
import * as weatherParsing from './weatherParsing';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function snapshot(): ForecastSnapshot {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-15T15:00:00Z'));
  const weather = buildMockWeather('wait');
  if (!weather) throw new Error('Missing fixture');
  return {
    weather,
    location: 'Brooklyn',
    lastUpdated: new Date(),
    isManualLocation: false,
    isDeviceLocation: false,
    source: 'mock',
    mockScenario: 'wait',
    rideDuration: '3h',
    nightRiding: false,
    acclimatization: { homeBaseline: null, thresholds: THRESHOLDS, exposureLevel: 'moderate' },
  };
}

describe('previewRideLength', () => {
  it('preserves the current forecast for the unchanged duration', () => {
    const current = snapshot();
    expect(previewRideLength(current, '3h')).toBe(current.weather);
  });
  it('previews mocks without mutating the committed forecast', () => {
    const current = snapshot();
    const before = structuredClone(current);
    const preview = previewRideLength(current, '1h');
    const window = preview?.daily[0]?.rideWindow;
    expect(window).toBeDefined();
    if (!window) throw new Error('Missing preview window');
    expect(window.endHour - window.startHour).toBe(1);
    expect(current).toEqual(before);
  });
  it('returns no preview for disk-only data or an unknown mock', () => {
    const current = snapshot();
    expect(previewRideLength({ ...current, mockScenario: null }, '2h')).toBeNull();
    expect(previewRideLength({ ...current, mockScenario: 'unknown' }, '2h')).toBeNull();
  });
  it('uses snapshot thresholds and night riding, retaining air quality and alerts', () => {
    const current = snapshot();
    const thresholds = { ...THRESHOLDS };
    // The parser owns payload validation; this test verifies preview wiring and extras.
    const data = {} as NonNullable<ForecastSnapshot['forecastData']>;
    const parse = vi.spyOn(weatherParsing, 'buildWeatherFromData').mockReturnValue(current.weather);
    const preview = previewRideLength(
      {
        ...current,
        mockScenario: null,
        forecastData: data,
        nightRiding: true,
        acclimatization: { ...current.acclimatization, thresholds },
        weather: { ...current.weather, aqi: 250 },
      },
      'allDay',
    );
    expect(parse).toHaveBeenCalledWith(data, thresholds, 24, true);
    expect(preview?.aqi).toBe(250);
    expect(preview?.hourly[0]?.condition).toBe('bad');
    expect(preview?.nwsAlerts).toEqual(current.weather.nwsAlerts);
  });
});
