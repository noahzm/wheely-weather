import { describe, expect, it } from 'vitest';
import { getDailyCondition } from './weather';
import { getBestDayInfo, getDayConditionReason } from '../utils/forecastHelpers';

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
        dewpoint: 76,
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
        gust: 34,
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
        windSpeed: 22,
        rainChance: 5,
      }),
    ).toBe('Very windy (22 mph)');
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
        dewpoint: 76,
      }),
    ).toBe('Oppressive humidity (dew 76°)');
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
