import { describe, expect, it } from 'vitest';

import { THRESHOLDS, formatIssuesAsSentence, getMessage, getOverallStatus } from '@/domain';
import type { ForecastSnapshot } from '@/services/forecastSnapshot';
import { buildMockWeather } from '@/services/mockWeather';
import { DEFAULT_EXPOSURE_LEVEL } from '@/types/settings';

import { buildWeatherFromData, type OpenMeteoData } from '@/services/weatherParsing';

import { buildWidgetSnapshot, upcomingForecasts, WIDGET_HOURS_AHEAD } from './widgetSnapshot';

const FETCHED_AT = new Date('2026-09-23T14:00:00Z');

function buildSnapshot(
  scenario: string,
  overrides: Partial<ForecastSnapshot> = {},
): ForecastSnapshot {
  const weather = buildMockWeather(scenario);
  if (!weather) throw new Error(`mock weather fixture missing: ${scenario}`);
  return {
    weather,
    location: 'Raleigh',
    lastUpdated: FETCHED_AT,
    isManualLocation: true,
    isDeviceLocation: false,
    mockScenario: null,
    source: 'manual',
    acclimatization: {
      homeBaseline: null,
      thresholds: THRESHOLDS,
      exposureLevel: DEFAULT_EXPOSURE_LEVEL,
    },
    ...overrides,
  };
}

describe('buildWidgetSnapshot', () => {
  it('never publishes mock previews to the widget', () => {
    const mock = buildSnapshot('ride', { mockScenario: 'ride' });
    expect(buildWidgetSnapshot(mock, 'fahrenheit')).toBeNull();
  });

  it('shows the sky as the detail on a ride day', () => {
    const snapshot = buildSnapshot('ride');
    const widget = buildWidgetSnapshot(snapshot, 'fahrenheit');
    expect(widget).toMatchObject({
      status: 'yes',
      condition: 'good',
      detail: snapshot.weather.condition,
      location: 'Raleigh',
      isCurrentLocation: false,
      updatedAt: FETCHED_AT.toISOString(),
    });
    expect(widget?.headline.length).toBeGreaterThan(0);
  });

  it('prefers improvement timing, then issues, when it is not a ride day', () => {
    const snapshot = buildSnapshot('rest');
    const { weather } = snapshot;
    const status = getOverallStatus(weather, THRESHOLDS);
    const message = getMessage(weather, status, THRESHOLDS, 'fahrenheit');
    const widget = buildWidgetSnapshot(snapshot, 'fahrenheit');
    expect(widget?.status).toBe(status);
    expect(status).not.toBe('yes');
    expect(widget?.detail).toBe(
      message.timing ?? (formatIssuesAsSentence(message.issues) || message.lead),
    );
  });

  it('says to wait, and why, when it is bad now but good later', () => {
    const widget = buildWidgetSnapshot(buildSnapshot('wait'), 'fahrenheit');
    expect(widget).toMatchObject({
      status: 'yes',
      waiting: true,
      detail: 'Now: rain expected (95%)',
      symbol: 'cloud.rain.fill',
    });
    expect(widget?.headline).toMatch(/(AM|PM)$/);
  });

  it('is not waiting on a plain ride day', () => {
    const widget = buildWidgetSnapshot(buildSnapshot('ride'), 'fahrenheit');
    expect(widget?.waiting).toBe(false);
  });

  it("paints the home screen's sky for the verdict's weather", () => {
    const snapshot = buildSnapshot('ride', {
      weather: { ...buildSnapshot('ride').weather, weatherCode: 95 },
    });
    expect(buildWidgetSnapshot(snapshot, 'fahrenheit')?.sky).toBe('storm');
  });

  it('keeps the plain page while waiting', () => {
    expect(buildWidgetSnapshot(buildSnapshot('wait'), 'fahrenheit')?.sky).toBeNull();
  });

  it('has no upcoming verdicts without a raw forecast to re-rate', () => {
    // Mocks, and snapshots restored from the disk cache, carry no payload.
    expect(buildWidgetSnapshot(buildSnapshot('ride'), 'fahrenheit')?.upcoming).toEqual([]);
  });

  it('flags a forecast that follows the device location', () => {
    const snapshot = buildSnapshot('ride', { isDeviceLocation: true, source: 'device' });
    expect(buildWidgetSnapshot(snapshot, 'fahrenheit')?.isCurrentLocation).toBe(true);
  });

  it('formats the temperature in the requested unit', () => {
    const snapshot = buildSnapshot('ride', {
      weather: { ...buildSnapshot('ride').weather, temperature: 68 },
    });
    expect(buildWidgetSnapshot(snapshot, 'fahrenheit')?.temperature).toBe('68°');
    expect(buildWidgetSnapshot(snapshot, 'celsius')?.temperature).toBe('20°');
  });

  it('maps the weather code to an SF Symbol', () => {
    const snapshot = buildSnapshot('ride', {
      weather: { ...buildSnapshot('ride').weather, weatherCode: 95 },
    });
    expect(buildWidgetSnapshot(snapshot, 'fahrenheit')?.symbol).toBe('cloud.bolt.fill');
  });
});

/**
 * A two-day forecast fetched at 2 PM (UTC, to keep times readable): raining
 * through 3 PM, then dry. Sunset is 7 PM, so today's best window is 4–7 PM.
 */
function makeForecastData(hourCount = 36): OpenMeteoData {
  const time = Array.from({ length: hourCount }, (_, i) => {
    const date = new Date(Date.UTC(2026, 8, 23, 14 + i));
    return date.toISOString().slice(0, 16);
  });
  const raining = (i: number) => i < 2;
  return {
    utc_offset_seconds: 0,
    current: {
      time: '2026-09-23T14:00',
      temperature_2m: 66,
      apparent_temperature: 66,
      wind_speed_10m: 5,
      wind_gusts_10m: 8,
      dewpoint_2m: 50,
      weather_code: 63,
      wind_direction_10m: 180,
    },
    hourly: {
      time,
      temperature_2m: time.map(() => 68),
      apparent_temperature: time.map(() => 68),
      wind_speed_10m: time.map(() => 5),
      wind_gusts_10m: time.map(() => 8),
      precipitation_probability: time.map((_, i) => (raining(i) ? 95 : 0)),
      precipitation: time.map((_, i) => (raining(i) ? 3 : 0)),
      weather_code: time.map((_, i) => (raining(i) ? 63 : 1)),
      dewpoint_2m: time.map(() => 50),
      uv_index: time.map(() => 3),
    },
    daily: {
      time: ['2026-09-23', '2026-09-24'],
      sunrise: ['2026-09-23T07:00', '2026-09-24T07:00'],
      sunset: ['2026-09-23T19:00', '2026-09-24T19:00'],
      apparent_temperature_max: [70, 70],
      temperature_2m_max: [70, 70],
      temperature_2m_min: [55, 55],
      wind_speed_10m_max: [8, 8],
      wind_gusts_10m_max: [12, 12],
      precipitation_probability_max: [95, 0],
      weather_code: [63, 1],
      uv_index_max: [5, 5],
    },
  };
}

function snapshotFromForecast(data: OpenMeteoData, aqi: number | null = null): ForecastSnapshot {
  const weather = { ...buildWeatherFromData(data, THRESHOLDS), aqi };
  return { ...buildSnapshot('ride'), weather, forecastData: data };
}

describe('upcoming verdicts', () => {
  it('rates each of the next hours, starting at the top of each hour', () => {
    const widget = buildWidgetSnapshot(snapshotFromForecast(makeForecastData()), 'fahrenheit');
    expect(widget?.upcoming).toHaveLength(WIDGET_HOURS_AHEAD);
    expect(widget?.upcoming[0]?.at).toBe('2026-09-23T15:00:00.000Z');
    expect(widget?.upcoming.at(-1)?.at).toBe('2026-09-24T02:00:00.000Z');
  });

  it('switches from waiting to go once the dry window opens', () => {
    const widget = buildWidgetSnapshot(snapshotFromForecast(makeForecastData()), 'fahrenheit');
    expect(widget).toMatchObject({ status: 'yes', waiting: true });
    expect(widget?.headline).toMatch(/4 PM$/);
    // Still raining at 3 PM; the window opens at 4.
    expect(widget?.upcoming[0]).toMatchObject({ waiting: true });
    expect(widget?.upcoming[1]).toMatchObject({
      at: '2026-09-23T16:00:00.000Z',
      status: 'yes',
      waiting: false,
      symbol: 'sun.max.fill',
    });
    expect(widget?.upcoming[1]?.headline).not.toMatch(/(AM|PM)$/);
  });

  it('rates each upcoming hour on its own for the hour strip', () => {
    const widget = buildWidgetSnapshot(snapshotFromForecast(makeForecastData()), 'fahrenheit');
    // 3 PM is still raining; the verdict then is waiting for the 4 PM window.
    expect(widget?.upcoming[0]).toMatchObject({ hourCondition: 'bad', sky: null });
    expect(widget?.upcoming[1]).toMatchObject({ hourCondition: 'good', sky: 'clear' });
  });

  it("moves on to tomorrow's window after sunset", () => {
    const widget = buildWidgetSnapshot(snapshotFromForecast(makeForecastData()), 'fahrenheit');
    // 8 PM: no daylight left today.
    expect(widget?.upcoming[5]?.detail).toMatch(/^Tomorrow/);
  });

  it('counts the new date as today after midnight', () => {
    const widget = buildWidgetSnapshot(snapshotFromForecast(makeForecastData()), 'fahrenheit');
    // 1 AM: the 7–10 AM window is today's now, not tomorrow's.
    expect(widget?.upcoming[10]?.at).toBe('2026-09-24T01:00:00.000Z');
    expect(widget?.upcoming[10]?.detail).toBe('Best 7 AM–10 AM');
  });

  it("carries today's AQI into the hours ahead", () => {
    const upcoming = upcomingForecasts(snapshotFromForecast(makeForecastData(), 160));
    expect(upcoming[0]?.weather.aqi).toBe(160);
  });

  it('stops where the hourly data ends', () => {
    const upcoming = upcomingForecasts(snapshotFromForecast(makeForecastData(5)));
    expect(upcoming).toHaveLength(4);
  });

  it('honors snapshot.rideDuration when rating future windows', () => {
    const snapshot = {
      ...snapshotFromForecast(makeForecastData()),
      rideDuration: 'short' as const,
    };
    const widget = buildWidgetSnapshot(snapshot, 'fahrenheit');
    // At 1 AM tomorrow, a 'short' (1h) window spans 7 AM–8 AM instead of 7 AM–10 AM.
    expect(widget?.upcoming[10]?.detail).toBe('Best 7 AM–8 AM');
  });
});
