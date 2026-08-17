import { describe, expect, it } from 'vitest';
import { getBestDayInfo, getDayConditionReason } from '../utils/forecastHelpers';
import {
  getAqiLabel,
  getBestRideWindow,
  getDailyCondition,
  getDewpointLabel,
  getMessage,
  getRainTiming,
  getWindArrowRotation,
  isThunderstorm,
} from './weather';

describe('Weather Utilities', () => {
  it('identifies thunderstorms correctly', () => {
    expect(isThunderstorm(95)).toBe(true);
    expect(isThunderstorm(96)).toBe(true);
    expect(isThunderstorm(99)).toBe(true);
    expect(isThunderstorm(3)).toBe(false);
  });

  it('provides correct AQI labels', () => {
    expect(getAqiLabel(25)).toBe('Good');
    expect(getAqiLabel(75)).toBe('Moderate');
    expect(getAqiLabel(125)).toBe('Unhealthy for Sensitive Groups');
  });

  it('provides correct Dewpoint labels', () => {
    expect(getDewpointLabel(45)).toBe('Dry');
    expect(getDewpointLabel(55)).toBe('Comfortable');
    expect(getDewpointLabel(75)).toBe('Oppressive');
  });

  it('rotates wind direction for arrow rotation', () => {
    expect(getWindArrowRotation(0)).toBe(90);
    expect(getWindArrowRotation(90)).toBe(180);
    expect(getWindArrowRotation(225)).toBe(315);
    expect(getWindArrowRotation(null)).toBeNull();
  });
});

describe('Rain Timing Logic', () => {
  it('returns "Clearing up by..." when rain is happening now but stops later', () => {
    const hourly = [
      { hour: 10, rainChance: 50 },
      { hour: 11, rainChance: 10 },
    ];
    expect(getRainTiming(hourly)).toBe('Clears by 11 AM');
  });

  it('handles midnight wraparound in rain timing', () => {
    const hourly = [
      { hour: 23, rainChance: 50 },
      { hour: 0, rainChance: 10 },
    ];
    expect(getRainTiming(hourly)).toBe('Clears by 12 AM');
  });

  it('handles rain spanning midnight', () => {
    const hourly = [
      { hour: 23, rainChance: 10 },
      { hour: 0, rainChance: 50 },
      { hour: 1, rainChance: 10 },
    ];
    expect(getRainTiming(hourly)).toBe('Rain 12 AM–1 AM');
  });

  it('returns "Rain likely after..." when rain starts later', () => {
    const hourly = [
      { hour: 10, rainChance: 0 },
      { hour: 11, rainChance: 50 },
    ];
    expect(getRainTiming(hourly)).toBe('Rain likely after 11 AM');
  });

  it('returns "Rain throughout" when it rains the entire window', () => {
    const hourly = [
      { hour: 10, rainChance: 50 },
      { hour: 11, rainChance: 60 },
    ];
    expect(getRainTiming(hourly)).toBe('Rain throughout');
  });

  it('uses the first contiguous shower block instead of merging separated rain periods', () => {
    const hourly = [
      { hour: 10, rainChance: 10 },
      { hour: 11, rainChance: 50 },
      { hour: 12, rainChance: 0 },
      { hour: 13, rainChance: 60 },
      { hour: 14, rainChance: 0 },
    ];

    expect(getRainTiming(hourly)).toBe('Rain 11 AM–12 PM');
  });

  it('does not call rain throughout when the current shower ends before a later second round', () => {
    const hourly = [
      { hour: 10, rainChance: 50 },
      { hour: 11, rainChance: 0 },
      { hour: 12, rainChance: 60 },
    ];

    expect(getRainTiming(hourly)).toBe('Clears by 11 AM');
  });
});

describe('Daily Forecast Logic', () => {
  it('marks thunderstorm days as bad even if other daily metrics look okay', () => {
    expect(getDailyCondition({ tempHigh: 65, wind: 8, rain: 20, code: 95 })).toBe('bad');
  });

  it('treats heavy rain codes as poor riding conditions even when rain percentage looks low', () => {
    expect(getDailyCondition({ tempHigh: 65, wind: 8, rain: 10, code: 65 })).toBe('poor');
  });

  it('downgrades snowy days so they are not presented as ideal ride days', () => {
    expect(getDailyCondition({ tempHigh: 34, wind: 8, rain: 20, code: 73 })).not.toBe('good');
  });

  it('downgrades a daily verdict when max dewpoint is oppressive', () => {
    expect(
      getDailyCondition({
        tempHigh: 65,
        wind: 8,
        rain: 10,
        code: 1,
        dewpoint: 79,
      }),
    ).toBe('bad');
  });

  it('does not change daily verdict when dewpoint is omitted', () => {
    expect(getDailyCondition({ tempHigh: 65, wind: 8, rain: 10, code: 1 })).toBe('good');
  });

  it('rates temperature on the worst air temperature across daylight hours', () => {
    // Mild afternoon high but a genuinely cold daytime low should pull it down.
    expect(
      getDailyCondition({
        tempLow: 34,
        tempHigh: 65,
        wind: 8,
        rain: 10,
        code: 1,
      }),
    ).toBe('marginal');
  });

  it('downgrades a daily verdict when gusts are strong even if sustained wind is calm', () => {
    expect(
      getDailyCondition({
        tempHigh: 65,
        wind: 8,
        gust: 36,
        rain: 10,
        code: 1,
      }),
    ).toBe('poor');
  });

  it('does not let high UV downgrade a daily verdict (UV is advice-only)', () => {
    expect(getDailyCondition({ tempHigh: 65, wind: 5, rain: 0, code: 1, uv: 9 })).toBe('good');
  });

  it('treats freezing fog as bad because of road ice', () => {
    expect(getDailyCondition({ tempHigh: 40, wind: 5, rain: 0, code: 48 })).toBe('bad');
  });
});

describe('Weekly Forecast Logic', () => {
  it('prefers the calmer and drier good day over the hotter one', () => {
    const daily = [
      {
        date: new Date('2026-04-19T12:00:00'),
        condition: 'good',
        high: 82,
        low: 63,
        windSpeed: 14,
        rainChance: 20,
      },
      {
        date: new Date('2026-04-20T12:00:00'),
        condition: 'good',
        high: 72,
        low: 56,
        windSpeed: 6,
        rainChance: 5,
      },
    ];

    expect(getBestDayInfo(daily).index).toBe(1);
  });

  it('explains when a day looks nice but rates badly because of wind', () => {
    expect(
      getDayConditionReason({
        condition: 'bad',
        weatherCode: 1,
        high: 72,
        low: 58,
        windSpeed: 32,
        rainChance: 5,
      }),
    ).toBe('Dangerous wind (32 mph)');
  });

  it('explains bad daily ratings caused by dangerous heat', () => {
    expect(
      getDayConditionReason({
        condition: 'bad',
        weatherCode: 1,
        high: 97,
        low: 78,
        windSpeed: 5,
        rainChance: 5,
        dewpoint: 62,
      }),
    ).toBe('Dangerous heat (97°)');
  });

  it('explains bad daily ratings caused by oppressive humidity', () => {
    expect(
      getDayConditionReason({
        condition: 'bad',
        weatherCode: 1,
        high: 82,
        low: 72,
        windSpeed: 5,
        rainChance: 5,
        dewpoint: 79,
      }),
    ).toBe('Oppressive humidity (dew 79°)');
  });

  it('surfaces a positive daily reason for strong ride days', () => {
    expect(
      getDayConditionReason({
        condition: 'good',
        weatherCode: 1,
        high: 72,
        low: 56,
        windSpeed: 6,
        rainChance: 5,
      }),
    ).toBe('Low wind and dry');
  });
});

describe('Hourly Message Logic', () => {
  // Flattens the structured verdict for substring assertions.
  const spoken = (message: ReturnType<typeof getMessage>) =>
    [message.lead, ...message.issues, message.timing ?? ''].join(' ');

  it('uses a natural weather phrase in the good-ride summary', () => {
    const weather = {
      hasThunderstorms: false,
      feelsLike: 68,
      windSpeed: 6,
      rainChance: 0,
      dewpoint: 50,
      aqi: 20,
      condition: 'Clear skies',
      hourly: [{ hour: 10, condition: 'good' }],
      daily: [],
    };

    const message = getMessage(weather, 'yes');
    expect(message.lead).toBe('68°F, clear skies, with light winds.');
    expect(message.issues).toEqual([]);
    expect(message.timing).toBeNull();
  });

  it('mentions when conditions become fair later even if they never reach fully good', () => {
    const weather = {
      hasThunderstorms: false,
      temperature: 33,
      windSpeed: 6,
      rainChance: 10,
      dewpoint: 50,
      aqi: 20,
      hourly: [
        { hour: 10, condition: 'bad' },
        { hour: 11, condition: 'fair' },
        { hour: 12, condition: 'fair' },
      ],
      daily: [],
    };

    expect(getMessage(weather, 'no').timing).toBe('Clears by 11 AM');
  });

  it('does not call mild weather too hot when the real issue is wind', () => {
    const weather = {
      hasThunderstorms: false,
      temperature: 70,
      windSpeed: 26, // poor sustained
      rainChance: 10,
      dewpoint: 50,
      aqi: 20,
      hourly: [{ hour: 10, condition: 'bad' }],
      daily: [],
    };

    const message = getMessage(weather, 'no');

    expect(spoken(message)).toContain('Very windy (26 mph)');
    expect(spoken(message)).not.toContain('Hot (70°F)');
  });

  it('lists each issue as its own chip label with an issues lead', () => {
    const weather = {
      hasThunderstorms: false,
      temperature: 48,
      windSpeed: 13,
      rainChance: 35,
      dewpoint: 50,
      aqi: 20,
      hourly: [{ hour: 10, condition: 'fair' }],
      daily: [],
    };

    const message = getMessage(weather, 'maybe');
    expect(message.lead).toBe('Rideable, but:');
    // 48°F rates `fair` (the 40-50 band), so it is phrased "Cool". The hero used
    // to collapse fair->marginal and overstate it as "Chilly" while the hourly
    // drawer said "Cool" for the same rating; both now share `issuePhraseTier`.
    expect(message.issues).toEqual(['Cool (48°F)', 'Breezy (13 mph)', 'Rain possible (35%)']);
  });

  it('keeps every issue when a day stacks up many of them', () => {
    const weather = {
      hasThunderstorms: false,
      temperature: 48,
      windSpeed: 13,
      rainChance: 35,
      dewpoint: 62,
      aqi: 80,
      hourly: [{ hour: 10, condition: 'fair' }],
      daily: [],
    };

    // cold, gusty, rainy, sticky, hazy => 5 chips, no "plus N more" collapse
    expect(getMessage(weather, 'maybe').issues).toHaveLength(5);
  });

  it('phrases a single rain issue naturally', () => {
    const weather = {
      hasThunderstorms: false,
      temperature: 60,
      windSpeed: 5,
      rainChance: 32,
      dewpoint: 50,
      aqi: 20,
      hourly: [{ hour: 10, condition: 'fair' }],
      daily: [],
    };

    expect(getMessage(weather, 'maybe').issues).toEqual(['Rain possible (32%)']);
  });

  it('rounds rain chance in rider-facing copy', () => {
    const weather = {
      hasThunderstorms: false,
      temperature: 60,
      windSpeed: 5,
      rainChance: 32 + 1e-14,
      dewpoint: 50,
      aqi: 20,
      hourly: [{ hour: 10, condition: 'fair' }],
      daily: [],
    };

    expect(getMessage(weather, 'maybe').issues).toEqual(['Rain possible (32%)']);
  });

  it('names heavy rain codes when rain percentage alone looks low', () => {
    const weather = {
      hasThunderstorms: false,
      temperature: 60,
      windSpeed: 5,
      rainChance: 10,
      dewpoint: 50,
      aqi: 20,
      weatherCode: 65,
      hourly: [{ hour: 10, condition: 'poor' }],
      daily: [],
    };

    expect(spoken(getMessage(weather, 'no'))).toContain('heavy rain');
  });

  it('names snow codes when raw metrics do not explain the downgrade', () => {
    const weather = {
      hasThunderstorms: false,
      temperature: 60,
      windSpeed: 5,
      rainChance: 10,
      dewpoint: 50,
      aqi: 20,
      weatherCode: 73,
      hourly: [{ hour: 10, condition: 'marginal' }],
      daily: [],
    };

    expect(spoken(getMessage(weather, 'maybe'))).toContain('snow');
  });

  it('names fog codes when raw metrics do not explain the downgrade', () => {
    const weather = {
      hasThunderstorms: false,
      temperature: 60,
      windSpeed: 5,
      rainChance: 10,
      dewpoint: 50,
      aqi: 20,
      weatherCode: 45,
      hourly: [{ hour: 10, condition: 'fair' }],
      daily: [],
    };

    expect(spoken(getMessage(weather, 'maybe'))).toContain('fog');
  });

  it('describes gusts when they are the worse wind factor', () => {
    const weather = {
      hasThunderstorms: false,
      temperature: 60,
      windSpeed: 8, // good sustained
      windGust: 36, // poor gusts
      rainChance: 0,
      dewpoint: 50,
      aqi: 20,
      hourly: [{ hour: 10, condition: 'poor' }],
      daily: [],
    };

    expect(spoken(getMessage(weather, 'no'))).toContain('Strong gusts (36 mph gusts)');
  });
});

describe('Best Ride Window', () => {
  it("returns 'Best now' when the current hour is good", () => {
    const hourly = [{ hour: 10, condition: 'good' }];
    expect(getBestRideWindow(hourly)).toBe('Best now');
  });

  it("returns 'Improves around X' when a later fair-or-better window exists", () => {
    const hourly = [
      { hour: 10, condition: 'bad' },
      { hour: 11, condition: 'bad' },
      { hour: 12, condition: 'fair' },
    ];
    expect(getBestRideWindow(hourly)).toBe('Improves around 12 PM');
  });

  it("returns 'No clear window' when conditions never improve", () => {
    const hourly = [
      { hour: 10, condition: 'bad' },
      { hour: 11, condition: 'poor' },
      { hour: 12, condition: 'bad' },
    ];
    expect(getBestRideWindow(hourly)).toBe('No clear window in the next 24 hours');
  });

  it('handles empty hourly', () => {
    expect(getBestRideWindow([])).toBeNull();
  });

  it('prefers good over fair when current is fair', () => {
    const hourly = [
      { hour: 10, condition: 'fair' },
      { hour: 11, condition: 'fair' },
      { hour: 12, condition: 'good' },
    ];
    expect(getBestRideWindow(hourly)).toBe('Improves around 12 PM');
  });
});
