import { afterEach, describe, it, expect, vi } from 'vitest';
import { isMockScenario, getMockLocationLabel, buildMockWeather } from './mockWeather';
import { getRideVerdict } from '@/domain';
import { selectRideHours } from '@/domain/gear';
import { ALL_DAY_RIDE_HOURS } from '@/domain/ride-window';
import { chartWindowBand } from '@/utils/hourlyChart';

afterEach(() => {
  vi.useRealTimers();
});

describe('mockWeather', () => {
  it('isMockScenario validates known scenarios', () => {
    expect(isMockScenario('ride')).toBe(true);
    expect(isMockScenario('maybe')).toBe(true);
    expect(isMockScenario('rest')).toBe(true);
    expect(isMockScenario('alert')).toBe(true);
    expect(isMockScenario('wait')).toBe(true);
    expect(isMockScenario('unknown')).toBe(false);
    expect(isMockScenario(null)).toBe(false);
  });

  it('getMockLocationLabel returns formatted label', () => {
    expect(getMockLocationLabel('ride')).toBe('Mock: Ride Day');
    expect(getMockLocationLabel('maybe')).toBe('Mock: Mixed Conditions');
    expect(getMockLocationLabel('rest')).toBe('Mock: Rest Day');
    expect(getMockLocationLabel('alert')).toBe('Mock: Severe Weather');
    expect(getMockLocationLabel('unknown')).toBeNull();
  });

  it('buildMockWeather builds weather object for all scenarios', () => {
    const ride = buildMockWeather('ride');
    expect(ride).not.toBeNull();
    expect(ride?.hourly.length).toBe(24);
    expect(ride?.daily.length).toBe(8);

    const maybe = buildMockWeather('maybe');
    expect(maybe).not.toBeNull();
    expect(maybe?.temperature).toBe(82);

    const rest = buildMockWeather('rest');
    expect(rest).not.toBeNull();
    expect(rest?.nwsAlerts?.length).toBe(0);

    const alert = buildMockWeather('alert');
    expect(alert).not.toBeNull();
    expect(alert?.nwsAlerts?.length).toBe(1);
    expect(alert?.nwsAlerts?.[0]?.severity).toBe('extreme');

    const unknown = buildMockWeather('unknown');
    expect(unknown).toBeNull();
  });

  it('wait scenario is a no-go now with a good window across all 24 clock hours', () => {
    vi.useFakeTimers();
    for (let hour = 0; hour < 24; hour++) {
      vi.setSystemTime(new Date(2026, 6, 15, hour, 15, 0));
      const wait = buildMockWeather('wait');
      expect(wait).not.toBeNull();
      if (!wait) continue;
      expect(wait.daily[0]?.rideWindow).toBeDefined();
      const verdict = getRideVerdict(wait);
      expect(verdict.when).toBe('wait');
      expect(verdict.status).toBe('yes');
      expect(verdict.window).not.toBeNull();

      const windowWithDay = verdict.window ? { ...verdict.window, tomorrow: false } : null;
      expect(selectRideHours(wait, windowWithDay).length).toBeGreaterThan(0);
      const chartData = wait.hourly.map((h, idx) => ({ idx, hour: h.hour, isPast: false }));
      expect(chartWindowBand(chartData, windowWithDay)).not.toBeNull();
    }
  });

  it('sizes future ride windows from the requested windowHours', () => {
    const fiveHour = buildMockWeather('ride', 5);
    expect(fiveHour?.daily[2]?.rideWindow).toMatchObject({ startHour: 12, endHour: 17 });

    const allDay = buildMockWeather('ride', ALL_DAY_RIDE_HOURS);
    expect(allDay?.daily[2]?.rideWindow).toMatchObject({ startHour: 6, endHour: 19 });
  });
});
