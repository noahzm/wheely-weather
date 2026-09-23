import { describe, expect, it } from 'vitest';

import { applyAirQualityToToday } from './air-quality';
import { THRESHOLDS } from './constants';

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

function day(condition: Condition = 'good'): DailyWeather {
  return {
    date: '2026-09-23',
    high: 70,
    low: 55,
    windSpeed: 5,
    windGust: null,
    rainChance: 0,
    weatherCode: 1,
    condition,
  };
}

function weather(aqi: number | null): Weather {
  return {
    temperature: 65,
    feelsLike: 65,
    windSpeed: 5,
    windGust: null,
    rainChance: 0,
    weatherCode: 1,
    hasThunderstorms: false,
    condition: 'Clear skies',
    dewpoint: 50,
    aqi,
    // 10 PM through 1 AM: two hours today, two tomorrow.
    hourly: [hour(22), hour(23), hour(0), hour(1)],
    pastHourly: [],
    daily: [day(), day()],
  };
}

describe('applyAirQualityToToday', () => {
  it('leaves the forecast alone without a reading', () => {
    const input = weather(null);
    expect(applyAirQualityToToday(input, THRESHOLDS)).toBe(input);
  });

  it('rates the rest of today no better than the air, and leaves tomorrow alone', () => {
    const result = applyAirQualityToToday(weather(160), THRESHOLDS);
    expect(result.hourly.map((h) => h.condition)).toEqual(['poor', 'poor', 'good', 'good']);
    expect(result.hourly.map((h) => h.aqi)).toEqual([160, 160, undefined, undefined]);
    expect(result.daily.map((d) => d.condition)).toEqual(['poor', 'good']);
  });

  it('never improves an hour that was already worse than the air', () => {
    const input = { ...weather(60), hourly: [hour(14, 'bad'), hour(15, 'good')] };
    const result = applyAirQualityToToday(input, THRESHOLDS);
    expect(result.hourly.map((h) => h.condition)).toEqual(['bad', 'fair']);
  });
});
