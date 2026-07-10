import { describe, expect, it } from 'vitest';
import {
  dayLabel,
  getBestDayInfo,
  getDayConditionReason,
  getHourConditionReasons,
  getBestDaysBlurb,
} from './forecastHelpers';

// Local-constructed dates keep getDay()/getDate() stable regardless of the runner's TZ.
// June 1 2026 is a Monday, so WEEK[0..6] runs Mon→Sun.
const WEEK = Array.from({ length: 7 }, (_, i) => new Date(2026, 5, 1 + i));
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
    ).toEqual(['Storm risk', 'Breezy (16 mph)', 'Some rain risk']);
  });

  it('does not add fallback reasons when hazardous weather is the only specific reason', () => {
    expect(getHourConditionReasons(hour({ condition: 'bad', weatherCode: 65 }))).toEqual([
      'Heavy rain risk',
    ]);
  });
});

describe('getBestDaysBlurb', () => {
  // Builds a week where the given indices are "good", the rest "marginal".
  const weekWith = (condByIndex: Record<number, string>) =>
    WEEK.map((date, i) => day({ date, condition: condByIndex[i] ?? 'marginal' }));

  it('names a single good day as the best ride window', () => {
    const daily = [day({ condition: 'good' })];
    expect(getBestDaysBlurb(daily, 0, 'Calm and steady')).toBe(
      'Today is your best ride window. Calm and steady expected.',
    );
  });

  it('lists two or three additional good days by name', () => {
    const daily = weekWith({ 0: 'good', 2: 'good', 4: 'good' });
    const blurb = getBestDaysBlurb(daily, 0, 'Warm and dry');
    expect(blurb).toContain('Today is the best bet.');
    expect(blurb).toContain('Warm and dry expected.');
    expect(blurb).toContain('Wednesday and Friday are solid ride windows too.');
  });

  it('summarizes instead of listing once four or more days qualify', () => {
    const daily = weekWith({
      0: 'good',
      1: 'good',
      2: 'good',
      3: 'good',
      4: 'good',
    });
    const blurb = getBestDaysBlurb(daily, 0, '');
    expect(blurb).toContain('Today is the best bet.');
    expect(blurb).toContain('Most of the week is rideable too.');
  });

  it('falls back to workable wording when no day is good', () => {
    const daily = WEEK.slice(0, 3).map((date, i) =>
      day({ date, condition: i === 2 ? 'fair' : i === 0 ? 'fair' : 'poor' }),
    );
    const blurb = getBestDaysBlurb(daily, 0, 'Comfortable');
    expect(blurb).toContain('Today is the best bet.');
    expect(blurb).toContain('Wednesday is a workable window too.');
  });

  it('summarizes a mostly-workable week', () => {
    const daily = WEEK.map((date) => day({ date, condition: 'fair' }));
    const blurb = getBestDaysBlurb(daily, 0, '');
    expect(blurb).toContain('Most of the week is at least workable.');
  });

  it('falls back to a no-standout-days message when nothing qualifies', () => {
    const daily = [day({ condition: 'poor' }), day({ condition: 'bad' })];
    const blurb = getBestDaysBlurb(daily, -1, '');
    expect(typeof blurb).toBe('string');
    expect(blurb.length).toBeGreaterThan(0);
  });
});
