import { describe, it, expect } from 'vitest';
import {
  isMockScenario,
  getMockScenarioFromParams,
  getMockLocationLabel,
  buildMockWeather,
} from './mockWeather';

describe('mockWeather', () => {
  it('isMockScenario validates known scenarios', () => {
    expect(isMockScenario('ride')).toBe(true);
    expect(isMockScenario('maybe')).toBe(true);
    expect(isMockScenario('rest')).toBe(true);
    expect(isMockScenario('alert')).toBe(true);
    expect(isMockScenario('unknown')).toBe(false);
    expect(isMockScenario(null)).toBe(false);
  });

  it('getMockScenarioFromParams extracts scenario from URLSearchParams', () => {
    const params = new URLSearchParams('?mock=maybe');
    expect(getMockScenarioFromParams(params)).toBe('maybe');

    const invalidParams = new URLSearchParams('?mock=invalid');
    expect(getMockScenarioFromParams(invalidParams)).toBeNull();

    const emptyParams = new URLSearchParams('');
    expect(getMockScenarioFromParams(emptyParams)).toBeNull();
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
    expect(rest?.nwsAlerts.length).toBe(0);

    const alert = buildMockWeather('alert');
    expect(alert).not.toBeNull();
    expect(alert?.nwsAlerts.length).toBe(1);
    expect(alert?.nwsAlerts[0].severity).toBe('extreme');

    const unknown = buildMockWeather('unknown');
    expect(unknown).toBeNull();
  });
});
