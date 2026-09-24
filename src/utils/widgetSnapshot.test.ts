import { describe, expect, it } from 'vitest';

import { THRESHOLDS, formatIssuesAsSentence, getMessage, getOverallStatus } from '@/domain';
import type { ForecastSnapshot } from '@/services/forecastSnapshot';
import { buildMockWeather } from '@/services/mockWeather';
import { DEFAULT_EXPOSURE_LEVEL } from '@/types/settings';

import { buildWidgetSnapshot, windowStartTime } from './widgetSnapshot';

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
    expect(widget?.windowStarts).toBeNull();
  });

  it('schedules the switch to the go verdict for when a waited-for window opens', () => {
    // The wait mock's window opens three hours after the fetch hour.
    const widget = buildWidgetSnapshot(buildSnapshot('wait'), 'fahrenheit');
    expect(widget?.windowStarts).toMatchObject({
      at: '2026-09-23T17:00:00.000Z',
      detail: 'Mostly clear',
      symbol: 'sun.max.fill',
    });
    // The plain ride-day headline, not "Wait till …".
    expect(widget?.windowStarts?.headline).not.toMatch(/(AM|PM)$/);
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

describe('windowStartTime', () => {
  const weather = buildMockWeather('ride');
  if (!weather) throw new Error('mock weather fixture missing');
  const fetchedAt = new Date('2026-09-23T14:25:00Z');
  const firstHour = weather.hourly[0]?.hour ?? 0;

  it('counts hours from the top of the fetch hour', () => {
    const inTwo = (firstHour + 2) % 24;
    expect(windowStartTime(weather, inTwo, fetchedAt)?.toISOString()).toBe(
      '2026-09-23T16:00:00.000Z',
    );
  });

  it('is null for a window already open or not in the hourly data', () => {
    expect(windowStartTime(weather, firstHour, fetchedAt)).toBeNull();
    expect(windowStartTime({ ...weather, hourly: [] }, 12, fetchedAt)).toBeNull();
  });
});
