import { describe, expect, it } from 'vitest';

import { heatIndex, relativeHumidity } from './heat-index';

describe('relativeHumidity', () => {
  it('saturates when the dew point reaches the air temperature, and caps there', () => {
    expect(relativeHumidity(70, 70)).toBeCloseTo(100);
    expect(relativeHumidity(70, 72)).toBe(100);
  });

  it('reads a warm, muggy afternoon', () => {
    expect(relativeHumidity(90, 74)).toBeCloseTo(59.5, 0);
  });
});

describe('heatIndex', () => {
  // The NWS chart is laid out by relative humidity, so each dew point is the
  // one that gives that row's humidity at that temperature.
  it.each([
    [90, 74.2, 100], // 60%
    [96, 74.4, 108], // 50%
    [100, 71.3, 109], // 40%
    [86, 82.7, 105], // 90%, with the muggy-air correction
    [80, 53.5, 80], // 40%, Steadman's simple form
  ])('matches the NWS chart at %i°F with a %f°F dew point', (temp, dewpoint, chart) => {
    expect(Math.round(heatIndex(temp, dewpoint) ?? Number.NaN)).toBe(chart);
  });

  it('stays near the air temperature in mild air', () => {
    expect(heatIndex(75, 55)).toBeCloseTo(74.5, 0);
  });

  it('corrects down for very dry air', () => {
    expect(heatIndex(100, 30)).toBeCloseTo(93.6, 0);
  });

  it('is unknown without a dew point', () => {
    expect(heatIndex(95, null)).toBeNull();
  });
});
