import { describe, it, expect } from 'vitest';
import { chartX, chartY, chartPolylinePoints } from './hourlyChart';

describe('chartX', () => {
  it('offsets by 24px + 44px per index', () => {
    expect(chartX(0)).toBe(24);
    expect(chartX(1)).toBe(68);
    expect(chartX(10)).toBe(464);
  });
});

describe('chartY', () => {
  it('maps "good" to top (small y)', () => {
    expect(chartY('good')).toBe(34); // 146 - (4/4)*112
  });
  it('maps "bad" to bottom (large y)', () => {
    expect(chartY('bad')).toBe(146); // 146 - (0/4)*112
  });
  it('maps "fair" correctly', () => {
    expect(chartY('fair')).toBe(62); // 146 - (3/4)*112 = 146-84 = 62
  });
  it('defaults unknown condition to "marginal" mid-point', () => {
    expect(chartY('unknown')).toBe(chartY('marginal'));
  });
});

describe('chartPolylinePoints', () => {
  it('produces space-separated x,y pairs', () => {
    const result = chartPolylinePoints([
      { idx: 0, condition: 'good' },
      { idx: 1, condition: 'bad' },
    ]);
    expect(result).toBe(`${chartX(0)},${chartY('good')} ${chartX(1)},${chartY('bad')}`);
  });
  it('returns empty string for empty input', () => {
    expect(chartPolylinePoints([])).toBe('');
  });
});
