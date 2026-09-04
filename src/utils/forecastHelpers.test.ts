import { describe, expect, it } from 'vitest';
import {
  dayLabel,
  getBestDayInfo,
  getDayConditionReason,
  getHourConditionReasons,
} from './forecastHelpers';
import { THRESHOLDS } from '../domain/constants';

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
  temperature: 65,
  feelsLike: 65,
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
    // bad, in priority order. Values are chosen to actually land in the tier the
    // row claims — the day reason now rates metrics against the same THRESHOLDS
    // table that rated the day, so an impossible pairing (a 'bad' day whose only
    // metric is marginal) correctly falls through to the generic phrasing.
    ['Dangerous wind (32 mph)', { condition: 'bad', windSpeed: 32 }],
    ['Rain expected (80%)', { condition: 'bad', rainChance: 80 }],
    ['Dangerous heat (97°)', { condition: 'bad', high: 97 }],
    ['Oppressive humidity (dew 79°)', { condition: 'bad', dewpoint: 79 }],
    ['Freezing temps', { condition: 'bad', low: 30 }],
    ['Rough day to ride', { condition: 'bad' }],
    // poor
    ['Very windy (27 mph)', { condition: 'poor', windSpeed: 27 }],
    ['Rain very likely (70%)', { condition: 'poor', rainChance: 70 }],
    ['Very hot (92°)', { condition: 'poor', high: 92 }],
    ['Very humid (dew 75°)', { condition: 'poor', dewpoint: 75 }],
    // A 35° low rates marginal on the shared table, so it cannot explain a
    // poor-rated day — the day falls through to generic poor-tier phrasing.
    ['Tough riding', { condition: 'poor', low: 35 }],
    ['Tough riding', { condition: 'poor' }],
    // marginal
    ['Windy (16 mph)', { condition: 'marginal', windSpeed: 16 }],
    ['Rain likely (45%)', { condition: 'marginal', rainChance: 45 }],
    ['Hot (86°)', { condition: 'marginal', high: 86 }],
    ['Muggy (dew 69°)', { condition: 'marginal', dewpoint: 69 }],
    // 32–39°F is the table's marginal cold band; 40+ is only fair.
    ['Cool start', { condition: 'marginal', low: 35 }],
    ['Mixed conditions', { condition: 'marginal', low: 40 }],
    ['Mixed conditions', { condition: 'marginal' }],
    // fair — its own copy ladder, not the shared ISSUE_PHRASES tiers
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
  it('returns an empty list for good hours without hazardous weather codes', () => {
    expect(getHourConditionReasons(hour({ condition: 'good' }))).toEqual([]);
  });

  it('excludes good metrics (like 6 mph wind or 50° dew) and returns tier reasons for fair metrics', () => {
    expect(getHourConditionReasons(hour({ condition: 'fair', windSpeed: 12 }))).toEqual([
      'Breezy (12 mph)',
    ]);
    expect(getHourConditionReasons(hour({ condition: 'fair', rainChance: 25 }))).toEqual([
      'Rain possible (25%)',
    ]);
    expect(getHourConditionReasons(hour({ condition: 'fair', temperature: 75 }))).toEqual([
      'Warm (75°F)',
    ]);
  });

  // Regression: the reason borrowed the gust's severity but printed the
  // sustained speed, yielding "Very windy (8 mph)" for a calm-but-gusty hour.
  it('names gusts, with the gust speed, when gusts set the rating', () => {
    expect(getHourConditionReasons(hour({ windSpeed: 8, windGust: 42 }))).toEqual([
      'Dangerous gusts (42 mph)',
    ]);
  });

  it('still names sustained wind when gusts are not the limiter', () => {
    expect(getHourConditionReasons(hour({ windSpeed: 24, windGust: 26 }))).toEqual([
      'Windy (24 mph)',
    ]);
  });

  // Temperature reasons rate and label air temperature only: feels-like is a
  // provider-specific derived value whose signal is already carried by the wind
  // and dewpoint metrics.
  it('labels a temperature reason with the air temperature', () => {
    expect(getHourConditionReasons(hour({ temperature: 48, feelsLike: 30 }))).toEqual([
      'Cool (48°F)',
    ]);
    expect(getHourConditionReasons(hour({ temperature: 71, feelsLike: 95 }))).toEqual([
      'Warm (71°F)',
    ]);
  });

  it('rates the temperate middle on air temperature, ignoring feels-like', () => {
    expect(getHourConditionReasons(hour({ temperature: 65, feelsLike: 95 }))).toEqual([]);
  });

  // Regression: an hour rated poor purely by the cold+rain hypothermia hazard
  // reported only "Cool" and "Rain possible", never naming the actual hazard.
  // The temperature is embedded in the hazard phrase ("Cold rain risk (44°F, 35%)"),
  // so a standalone temperature reason is omitted to prevent redundant clauses.
  it('names the cold-rain hazard in place of the plain rain reason and omits redundant temperature', () => {
    expect(
      getHourConditionReasons(hour({ temperature: 44, feelsLike: 44, rainChance: 35 })),
    ).toEqual(['Cold rain risk (44°F, 35%)']);
  });

  it('falls back to a tier phrase when no metric explains a non-good rating', () => {
    // AQI and other non-hourly metrics can set the rating with every hourly
    // metric reading fine; the drawer must not render empty.
    expect(getHourConditionReasons(hour({ condition: 'poor' }))).toEqual(['Tough riding']);
    expect(getHourConditionReasons(hour({ condition: 'good' }))).toEqual([]);
  });

  it('returns all matching metric reasons sorted worst-first, or top N with limit', () => {
    // Dangerous heat is bad (worst), while dewpoint is also bad, rain is poor and wind is marginal.
    // By default, all matching reasons are returned in severity order.
    expect(
      getHourConditionReasons(
        hour({ condition: 'bad', windSpeed: 24, rainChance: 65, temperature: 97, dewpoint: 79 }),
      ),
    ).toEqual([
      'Dangerous heat (97°F)',
      'Oppressive humidity (dew 79°F)',
      'Windy (24 mph)',
      'Rain likely (65%)',
    ]);

    // With limit: 1, primary limiter is returned.
    expect(
      getHourConditionReasons(
        hour({ condition: 'bad', windSpeed: 24, rainChance: 65, temperature: 97, dewpoint: 79 }),
        'fahrenheit',
        THRESHOLDS,
        { limit: 1 },
      ),
    ).toEqual(['Dangerous heat (97°F)']);

    // With limit: 2, top 2 are returned.
    expect(
      getHourConditionReasons(
        hour({ condition: 'bad', windSpeed: 24, rainChance: 65, temperature: 97, dewpoint: 79 }),
        'fahrenheit',
        THRESHOLDS,
        { limit: 2 },
      ),
    ).toEqual(['Dangerous heat (97°F)', 'Oppressive humidity (dew 79°F)']);
  });

  it('includes heat and humidity reasons together', () => {
    expect(
      getHourConditionReasons(hour({ condition: 'poor', temperature: 94, dewpoint: 69 })),
    ).toEqual(['Very hot (94°F)', 'Muggy (dew 69°F)']);
  });

  it('includes hazardous weather code reasons plus limiting metric reasons', () => {
    expect(
      getHourConditionReasons(
        hour({ condition: 'marginal', weatherCode: 95, windSpeed: 16, rainChance: 35 }),
      ),
    ).toEqual(['Storm risk', 'Windy (16 mph)', 'Rain possible (35%)']);

    expect(
      getHourConditionReasons(
        hour({ condition: 'marginal', weatherCode: 95, windSpeed: 16, rainChance: 35 }),
        'fahrenheit',
        THRESHOLDS,
        { limit: 1 },
      ),
    ).toEqual(['Storm risk']);

    expect(
      getHourConditionReasons(
        hour({ condition: 'marginal', weatherCode: 95, windSpeed: 16, rainChance: 35 }),
        'fahrenheit',
        THRESHOLDS,
        { limit: 2 },
      ),
    ).toEqual(['Storm risk', 'Windy (16 mph)']);
  });

  it('still names lower-tier metrics in an hour dragged bad by a single metric, sorted by severity', () => {
    // Dew 79 makes the hour bad; 94° heat is only poor-tier. Both are returned with bad-tier first.
    expect(
      getHourConditionReasons(hour({ condition: 'bad', temperature: 94, dewpoint: 79 })),
    ).toEqual(['Oppressive humidity (dew 79°F)', 'Very hot (94°F)']);

    // With limit: 1, only the bad-tier primary limiter is returned.
    expect(
      getHourConditionReasons(
        hour({ condition: 'bad', temperature: 94, dewpoint: 79 }),
        'fahrenheit',
        THRESHOLDS,
        { limit: 1 },
      ),
    ).toEqual(['Oppressive humidity (dew 79°F)']);
  });

  it('does not add fallback reasons when hazardous weather is the only specific reason', () => {
    expect(getHourConditionReasons(hour({ condition: 'bad', weatherCode: 65 }))).toEqual([
      'Heavy rain risk',
    ]);
  });

  it('deduplicates generic heavy rain risk when specific cold rain or severe rain is already present', () => {
    // When freezing rain hazard is present, generic heavy rain code is suppressed
    expect(
      getHourConditionReasons(
        hour({ condition: 'bad', temperature: 35, rainChance: 80, weatherCode: 65 }),
      ),
    ).toEqual(['Freezing rain risk (35°F, 80%)']);

    // When rain expected (80%) is present, generic heavy rain code is suppressed
    expect(
      getHourConditionReasons(
        hour({ condition: 'bad', temperature: 72, rainChance: 80, weatherCode: 65 }),
      ),
    ).toEqual(['Rain expected (80%)']);

    // When rain chance is marginal (45%), the heavy rain code (poor) outranks and replaces it
    expect(
      getHourConditionReasons(
        hour({ condition: 'poor', temperature: 72, rainChance: 45, weatherCode: 65 }),
      ),
    ).toEqual(['Heavy rain risk']);
  });
});
