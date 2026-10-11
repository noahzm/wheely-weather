import { describe, expect, it } from 'vitest';

import { applyAcclimatization } from '../domain/acclimatization';
import { THRESHOLDS } from '../domain/constants';

import { getMetricExplainer } from './metricExplainers';

describe('getMetricExplainer', () => {
  it('returns cycling-specific guidance for known metrics', () => {
    const dewpoint = getMetricExplainer('Dewpoint');
    expect(dewpoint?.title).toBe('Dewpoint & Moisture');
    // Bands match THRESHOLDS.DEWPOINT (fair from 58°F, marginal from 66°F).
    expect(dewpoint?.tip).toContain('58–66°F');

    expect(getMetricExplainer('Wind')?.title).toBe('Wind & Gusts');
    expect(getMetricExplainer('Rain Chance')?.tip).toContain('rain jacket');
    expect(getMetricExplainer('Air Quality')?.tip).toContain('AQI 0–50 is ideal; 51–100');
    expect(getMetricExplainer('Temperature')?.tip).toContain('5–10°F colder');
    expect(getMetricExplainer('Sunrise')?.tip).toContain('daytime lights');
    expect(getMetricExplainer('Sunset')?.tip).toContain('taillight');
  });

  it('describes the hour the card shows, not a window or the day’s peak', () => {
    expect(getMetricExplainer('Rain Chance')?.summary).toContain('this hour');
    expect(getMetricExplainer('UV Index')?.summary).toContain('this hour');
  });

  it('puts sunscreen at the same UV level the kit does', () => {
    expect(getMetricExplainer('UV Index')?.tip).toMatch(/^UV 3\+ calls for sunscreen/);
  });

  it('quotes the rider’s own dew point bands, in their unit', () => {
    const humidHome = applyAcclimatization(THRESHOLDS, {
      tempShift: 0,
      dewShift: 6,
      coldShift: 0,
    });
    const tip = getMetricExplainer('Dewpoint', { thresholds: humidHome, unit: 'fahrenheit' })?.tip;
    expect(tip).toContain('Under 64°F');
    expect(tip).toContain('64–72°F');

    const celsius = getMetricExplainer('Dewpoint', { thresholds: THRESHOLDS, unit: 'celsius' });
    expect(celsius?.tip).toContain('Under 14°C');
    expect(celsius?.tip).toContain('14–19°C');
    expect(celsius?.tip).not.toContain('°F');
  });

  it('converts temperature differences, not just readings, to Celsius', () => {
    const tip = getMetricExplainer('Temperature', { thresholds: THRESHOLDS, unit: 'celsius' })?.tip;
    expect(tip).toContain('3–6°C colder');
  });

  it('returns null for unknown metric label', () => {
    expect(getMetricExplainer('Unknown Metric')).toBeNull();
  });
});
