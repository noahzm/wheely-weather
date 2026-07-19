import { describe, expect, it } from 'vitest';
import { getHourConditionReasons } from '../../utils/forecastHelpers';

function makeHour(overrides: Record<string, unknown> = {}) {
  return {
    hour: 10,
    condition: 'good',
    temperature: 72,
    feelsLike: 72,
    windSpeed: 6,
    windGust: null,
    rainChance: 5,
    weatherCode: 1,
    dewpoint: 50,
    ...overrides,
  };
}

describe('hourly chart reason integration', () => {
  it('joins multiple metric reasons in priority order', () => {
    const reasons = getHourConditionReasons(
      makeHour({ condition: 'bad', windSpeed: 24, rainChance: 65, temperature: 97, dewpoint: 76 }),
    );
    expect(reasons.join(' • ')).toBe(
      'Very windy (24 mph) • Rain likely (65%) • Dangerous heat (97°) • Oppressive humidity (dew 76°)',
    );
  });

  it('opens-equivalent: returns reasons for hazardous weather codes on good hours', () => {
    const reasons = getHourConditionReasons(makeHour({ condition: 'good', weatherCode: 95 }));
    expect(reasons).toEqual(['Storm risk']);
  });

  it('closes-equivalent: returns no reasons for non-hazardous good/fair hours', () => {
    expect(getHourConditionReasons(makeHour({ condition: 'good', windSpeed: 12 }))).toEqual([]);
    expect(getHourConditionReasons(makeHour({ condition: 'fair', windSpeed: 12 }))).toEqual([]);
  });

  it('includes hazardous weather codes alongside other limiting metric reasons', () => {
    const reasons = getHourConditionReasons(
      makeHour({ condition: 'marginal', weatherCode: 95, windSpeed: 16, rainChance: 35 }),
    );
    expect(reasons.join(' • ')).toBe('Storm risk • Breezy (16 mph) • Rain possible (35%)');
  });

  it('does not add fallback reasons when a specific reason exists', () => {
    expect(getHourConditionReasons(makeHour({ condition: 'bad', weatherCode: 65 }))).toEqual([
      'Heavy rain risk',
    ]);
  });
});
