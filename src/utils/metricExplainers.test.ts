import { describe, expect, it } from 'vitest';
import { getMetricExplainer } from './metricExplainers';

describe('getMetricExplainer', () => {
  it('returns cycling-specific guidance for known metrics', () => {
    const dewpoint = getMetricExplainer('Dewpoint');
    expect(dewpoint).not.toBeNull();
    expect(dewpoint?.title).toBe('Dewpoint & Moisture');
    expect(dewpoint?.tip).toContain('sweat evaporation');

    const wind = getMetricExplainer('Wind');
    expect(wind).not.toBeNull();
    expect(wind?.title).toBe('Wind & Gusts');
    expect(wind?.tip).toContain('aero');

    const rain = getMetricExplainer('Rain Chance');
    expect(rain?.tip).toContain('rain jacket');

    const uv = getMetricExplainer('UV Index');
    expect(uv?.tip).toContain('sunscreen');

    const aqi = getMetricExplainer('Air Quality');
    expect(aqi?.tip).toContain('Aerobic');

    const temp = getMetricExplainer('Temperature');
    expect(temp?.tip).toContain('wind chill');

    const sunrise = getMetricExplainer('Sunrise');
    expect(sunrise?.tip).toContain('running lights');

    const sunset = getMetricExplainer('Sunset');
    expect(sunset?.tip).toContain('taillight');
  });

  it('returns null for unknown metric label', () => {
    expect(getMetricExplainer('Unknown Metric')).toBeNull();
  });
});
