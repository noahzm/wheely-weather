import type { DailyWeather, HourlyWeather, Weather } from '@/types/weather';

// Typed builders for test data. Defaults describe a mild, dry, calm day, so a
// test only spells out the fields it is about. Nullable fields default to null
// ("provider didn't say"), and feels-like follows the temperature unless set.

export function makeHour(overrides: Partial<HourlyWeather> = {}): HourlyWeather {
  const temperature = overrides.temperature ?? 65;
  return {
    hour: 10,
    temperature,
    feelsLike: temperature,
    windSpeed: 5,
    windGust: null,
    rainChance: 0,
    dewpoint: null,
    weatherCode: null,
    condition: 'good',
    ...overrides,
  };
}

export function makeDay(overrides: Partial<DailyWeather> = {}): DailyWeather {
  return {
    date: new Date(2026, 5, 22),
    high: 72,
    low: 55,
    windSpeed: 5,
    windGust: null,
    rainChance: 0,
    weatherCode: null,
    condition: 'good',
    ...overrides,
  };
}

export function makeWeather(overrides: Partial<Weather> = {}): Weather {
  const temperature = overrides.temperature ?? 65;
  return {
    temperature,
    feelsLike: temperature,
    windSpeed: 5,
    windGust: null,
    rainChance: 0,
    weatherCode: null,
    hasThunderstorms: false,
    condition: 'good',
    dewpoint: 50,
    aqi: null,
    hourly: [],
    pastHourly: [],
    daily: [],
    ...overrides,
  };
}
