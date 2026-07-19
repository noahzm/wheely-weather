import { describe, expect, it } from 'vitest';
import {
  dayLabel,
  getBestDayInfo,
  getDayConditionReason,
  getHourConditionReasons,
} from './forecastHelpers';

// Local-constructed dates keep getDay()/getDate() stable regardless of the runner's TZ.
const JUN_22 = new Date(2026, 5, 22); // Monday
const JUN_24 = new Date(2026, 5, 24); // Wednesday

const day = (overrides = {}) => ({
  date: JUN_22,
  condition: 'fair',
  high: 72,
  low: 55,
  windSpeed: 6,
  rainChance: 5,
  weatherCode: 1,
  dewpoint: 50,
  feelsLike: 72,
  ...overrides,
});

const hour = (overrides = {}) => ({
  hour: 10,
  condition: 'fair',
  temperature: 72,
  feelsLike: 72,
  windSpeed: 6,
  windGust: null,
  rainChance: 5,
  weatherCode: 1,
  dewpoint: 50,
  ...overrides,
});

describe('dayLabel', () => {
  it('returns Today for index 0', () => {
    expect(dayLabel(JUN_24, 0)).toBe('Today');
  });

  it('returns a short weekday + date for later days', () => {
    expect(dayLabel(JUN_24, 3)).toBe('Wed 24');
    expect(dayLabel(JUN_22, 1)).toBe('Mon 22');
  });
});

describe('getBestDayInfo', () => {
  it('returns index -1 for empty or missing input', () => {
    expect(getBestDayInfo([])).toEqual({ index: -1, rationale: '' });
    expect(getBestDayInfo(null)).toEqual({ index: -1, rationale: '' });
  });

  it('prefers a good day over a fair one regardless of order', () => {
    const daily = [day({ condition: 'fair' }), day({ condition: 'good' })];
    expect(getBestDayInfo(daily).index).toBe(1);
  });

  it('reports -1 when even the best day is not good or fair', () => {
    const daily = [day({ condition: 'poor' }), day({ condition: 'bad' })];
    expect(getBestDayInfo(daily)).toEqual({ index: -1, rationale: '' });
  });

  it('skips today when no full upcoming ride window remains', () => {
    const daily = [
      day({ condition: 'good', rideWindowUnavailable: true }),
      day({ condition: 'fair' }),
    ];
    expect(getBestDayInfo(daily).index).toBe(1);
  });

  // Each row isolates one rationale branch for the single (best) day.
  it.each([
    ['Low wind and dry roads', { rainChance: 5, windSpeed: 6 }],
    ['Cool and clear', { rainChance: 15, windSpeed: 9, high: 45 }],
    ['Warm and dry', { rainChance: 15, windSpeed: 9, high: 85 }],
    ['Calm and steady', { rainChance: 15, windSpeed: 9, high: 70 }],
    ['Comfortable and dry', { rainChance: 15, windSpeed: 11, high: 70 }],
    ['Solid riding weather', { rainChance: 25, windSpeed: 12, high: 70 }],
  ])('rationale %s', (rationale, fields) => {
    const daily = [day({ condition: 'good', ...fields })];
    expect(getBestDayInfo(daily)).toEqual({ index: 0, rationale });
  });
});

describe('getDayConditionReason', () => {
  it('prioritizes hazardous weather codes over condition', () => {
    expect(getDayConditionReason(day({ weatherCode: 95 }))).toBe('Storm risk');
    expect(getDayConditionReason(day({ weatherCode: 73 }))).toBe('Wintry roads');
    expect(getDayConditionReason(day({ weatherCode: 65 }))).toBe('Heavy rain risk');
  });

  // Exhaustive branch coverage: defaults are calm/dry/mild, each row trips one branch.
  it.each([
    // bad, in priority order
    ['Very windy (24 mph)', { condition: 'bad', windSpeed: 24 }],
    ['Rain likely (65%)', { condition: 'bad', rainChance: 65 }],
    ['Dangerous heat (97°)', { condition: 'bad', high: 97 }],
    ['Oppressive humidity (dew 76°)', { condition: 'bad', dewpoint: 76 }],
    ['Freezing temps', { condition: 'bad', low: 30 }],
    ['Rough day to ride', { condition: 'bad' }],
    // poor
    ['Windy (19 mph)', { condition: 'poor', windSpeed: 19 }],
    ['Wet roads likely', { condition: 'poor', rainChance: 50 }],
    ['Very hot (94°)', { condition: 'poor', high: 94 }],
    ['Very humid (dew 69°)', { condition: 'poor', dewpoint: 69 }],
    ['Cold start', { condition: 'poor', low: 35 }],
    ['Tough riding', { condition: 'poor' }],
    // marginal
    ['Breezy (16 mph)', { condition: 'marginal', windSpeed: 16 }],
    ['Some rain risk', { condition: 'marginal', rainChance: 35 }],
    ['Warm (86°)', { condition: 'marginal', high: 86 }],
    ['Muggy (dew 66°)', { condition: 'marginal', dewpoint: 66 }],
    ['Cool start', { condition: 'marginal', low: 40 }],
    ['Mixed conditions', { condition: 'marginal' }],
    // fair
    ['Breezy', { condition: 'fair', windSpeed: 12 }],
    ['Chance of rain', { condition: 'fair', rainChance: 20 }],
    ['Cool but clear', { condition: 'fair', high: 45 }],
    ['Warm but workable', { condition: 'fair', high: 88 }],
    ['Fair window', { condition: 'fair' }],
    // good (fallthrough)
    ['Low wind and dry', { condition: 'good' }],
    ['Cool and clear', { condition: 'good', windSpeed: 10, high: 45 }],
    ['Warm and dry', { condition: 'good', windSpeed: 10, high: 85 }],
    ['Calm and steady', { condition: 'good', windSpeed: 10 }],
    ['Comfortable and dry', { condition: 'good', windSpeed: 11 }],
    ['Prime riding weather', { condition: 'good', windSpeed: 12, rainChance: 25 }],
  ])('returns %s', (expected, fields) => {
    expect(getDayConditionReason(day(fields))).toBe(expected);
  });
});

describe('getHourConditionReasons', () => {
  it('returns an empty list for good and fair hours without hazardous weather codes', () => {
    expect(getHourConditionReasons(hour({ condition: 'good' }))).toEqual([]);
    expect(getHourConditionReasons(hour({ condition: 'fair', windSpeed: 12 }))).toEqual([]);
  });

  it('returns every matching metric reason in priority order', () => {
    expect(
      getHourConditionReasons(
        hour({ condition: 'bad', windSpeed: 24, rainChance: 65, temperature: 97, dewpoint: 76 }),
      ),
    ).toEqual([
      'Very windy (24 mph)',
      'Rain likely (65%)',
      'Dangerous heat (97°)',
      'Oppressive humidity (dew 76°)',
    ]);
  });

  it('includes heat and humidity reasons together', () => {
    expect(
      getHourConditionReasons(hour({ condition: 'poor', temperature: 94, dewpoint: 69 })),
    ).toEqual(['Very hot (94°)', 'Very humid (dew 69°)']);
  });

  it('includes hazardous weather code reasons plus limiting metric reasons', () => {
    expect(
      getHourConditionReasons(
        hour({ condition: 'marginal', weatherCode: 95, windSpeed: 16, rainChance: 35 }),
      ),
    ).toEqual(['Storm risk', 'Breezy (16 mph)', 'Rain possible (35%)']);
  });

  it('still names lower-tier metrics in an hour dragged bad by a single metric', () => {
    // Dew 76 makes the hour bad; 88° heat is only poor-tier but must not vanish.
    expect(
      getHourConditionReasons(hour({ condition: 'bad', temperature: 88, dewpoint: 76 })),
    ).toEqual(['Very hot (88°)', 'Oppressive humidity (dew 76°)']);
  });

  it('does not add fallback reasons when hazardous weather is the only specific reason', () => {
    expect(getHourConditionReasons(hour({ condition: 'bad', weatherCode: 65 }))).toEqual([
      'Heavy rain risk',
    ]);
  });
});
