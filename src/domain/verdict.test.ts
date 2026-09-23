import { describe, expect, it } from 'vitest';

import { THRESHOLDS } from './constants';
import { getOverallStatus } from './scoring';
import { getRideVerdict } from './verdict';

import type { Condition, DailyWeather, HourlyWeather, Weather } from '@/types/weather';

function hour(h: number, condition: Condition = 'good'): HourlyWeather {
  return {
    hour: h,
    temperature: 65,
    feelsLike: 65,
    windSpeed: 5,
    windGust: null,
    rainChance: 0,
    dewpoint: 50,
    weatherCode: 1,
    condition,
  };
}

type Window = NonNullable<DailyWeather['rideWindow']>;

function day(overrides: Partial<DailyWeather> = {}, window: Window | null = null): DailyWeather {
  return {
    date: '2026-09-23',
    high: 70,
    low: 55,
    windSpeed: 5,
    windGust: null,
    rainChance: 0,
    dewpoint: 50,
    weatherCode: 1,
    condition: 'good',
    ...(window ? { rideWindow: window } : { rideWindowUnavailable: true }),
    ...overrides,
  };
}

const window = (startHour: number, endHour: number, tempLow = 64, tempHigh = 68): Window => ({
  startHour,
  endHour,
  tempLow,
  tempHigh,
});

/** Right now: 8 AM, pouring rain. */
function rainyMorning(daily: DailyWeather[]): Weather {
  return {
    temperature: 58,
    feelsLike: 58,
    windSpeed: 5,
    windGust: null,
    rainChance: 95,
    weatherCode: 63,
    hasThunderstorms: false,
    condition: 'Rain',
    dewpoint: 52,
    aqi: 30,
    hourly: [hour(8, 'bad'), hour(9, 'bad'), hour(10, 'fair')],
    pastHourly: [],
    daily,
  };
}

describe('getRideVerdict', () => {
  it('rates a dry afternoon, not the wet morning, and says when', () => {
    const weather = rainyMorning([day({}, window(14, 17)), day({}, window(9, 12))]);
    expect(getOverallStatus(weather, THRESHOLDS)).toBe('no');

    const verdict = getRideVerdict(weather, THRESHOLDS);
    expect(verdict.status).toBe('yes');
    expect(verdict.when).toBe('later');
    expect(verdict.message.timing).toBe('Best 2 PM–5 PM');
  });

  it('shows no timing when the best window is underway', () => {
    const weather = rainyMorning([day({}, window(8, 11)), day({}, window(9, 12))]);
    const verdict = getRideVerdict(weather, THRESHOLDS);
    expect(verdict.when).toBe('now');
    expect(verdict.message.timing).toBeNull();
  });

  it('rates tomorrow once no daylight is left today, without today’s air reading', () => {
    const weather = {
      ...rainyMorning([day(), day({ rainChance: 10 }, window(9, 12))]),
      aqi: 180,
      hourly: [hour(21), hour(22)],
    };
    const verdict = getRideVerdict(weather, THRESHOLDS);
    expect(verdict.when).toBe('tomorrow');
    expect(verdict.status).toBe('yes');
    expect(verdict.rated.aqi).toBeNull();
    expect(verdict.message.timing).toBe('Tomorrow 9 AM–12 PM');
  });

  it('carries today’s air quality into a window later today', () => {
    const weather = { ...rainyMorning([day({}, window(14, 17))]), aqi: 180 };
    expect(getRideVerdict(weather, THRESHOLDS).status).toBe('no');
  });

  it('offers no window on a day that is bad even at its best', () => {
    const weather = rainyMorning([day({ rainChance: 90 }, window(14, 17))]);
    const verdict = getRideVerdict(weather, THRESHOLDS);
    expect(verdict.status).toBe('no');
    expect(verdict.message.timing).toBeNull();
  });

  it('rates the window on whichever end of its temperature range is worse', () => {
    const cold = rainyMorning([day({}, window(14, 17, 38, 60))]);
    expect(getRideVerdict(cold, THRESHOLDS).rated.temperature).toBe(38);
    const mild = rainyMorning([day({}, window(14, 17, 62, 70))]);
    expect(getRideVerdict(mild, THRESHOLDS).rated.temperature).toBe(70);
  });

  it('falls back to the current conditions when no window exists', () => {
    const weather = rainyMorning([day(), day()]);
    const verdict = getRideVerdict(weather, THRESHOLDS);
    expect(verdict.when).toBe('current');
    expect(verdict.window).toBeNull();
    expect(verdict.status).toBe(getOverallStatus(weather, THRESHOLDS));
  });
});
