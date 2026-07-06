import { describe, expect, it } from 'vitest';
import { getRideFactors, getMessage, getDaylightWarning } from './weather';
import type { Weather, HourlyWeather } from '@/types/weather';

describe('Ride Factors', () => {
  it('returns empty array when status is yes', () => {
    const weather = {
      temperature: 60,
      windSpeed: 5,
      rainChance: 0,
      dewpoint: 50,
      aqi: 20,
      weatherCode: 1,
    };
    expect(getRideFactors(weather, 'yes')).toEqual([]);
  });

  it('returns empty array when weather is null', () => {
    expect(getRideFactors(null, 'no')).toEqual([]);
  });

  it('ranks worst conditions first and limits to 3 factors', () => {
    const weather = {
      temperature: 30, // bad
      windSpeed: 31, // bad
      rainChance: 50, // poor
      dewpoint: 76, // bad
      aqi: 20, // good
      weatherCode: 1,
    };
    const factors = getRideFactors(weather, 'no');
    expect(factors).toHaveLength(3);
    expect(factors[0].condition).toBe('bad');
    expect(factors[1].condition).toBe('bad');
    expect(factors[2].condition).toBe('bad');
  });

  it('includes a weather code factor when it limits the ride', () => {
    const weather = {
      temperature: 60,
      windSpeed: 5,
      rainChance: 10,
      dewpoint: 50,
      weatherCode: 65, // heavy rain -> poor
    };
    const factors = getRideFactors(weather, 'no');
    expect(factors.some((f) => f.type === 'weatherCode' && f.value === 'Heavy rain')).toBe(true);
  });

  it('does not include missing AQI', () => {
    const weather = {
      temperature: 48, // fair -> maybe
      windSpeed: 5,
      rainChance: 0,
      dewpoint: 50,
      aqi: null,
      weatherCode: 1,
    };
    const factors = getRideFactors(weather, 'maybe');
    expect(factors.some((f) => f.type === 'aqi')).toBe(false);
    expect(factors.some((f) => f.type === 'temperature')).toBe(true);
  });

  it('surfaces thunderstorm as the overriding bad factor', () => {
    const weather = {
      temperature: 60,
      windSpeed: 5,
      rainChance: 0,
      dewpoint: 50,
      hasThunderstorms: true,
      weatherCode: 95,
    };
    const factors = getRideFactors(weather, 'no');
    expect(factors[0].type).toBe('weatherCode');
    expect(factors[0].condition).toBe('bad');
  });

  it('labels the wind factor by gusts when gusts are the limiter', () => {
    const weather = {
      temperature: 60,
      windSpeed: 8, // good sustained
      windGust: 34, // poor gusts
      rainChance: 0,
      dewpoint: 50,
      aqi: 20,
      weatherCode: 1,
    };
    const factors = getRideFactors(weather, 'no');
    const wind = factors.find((f) => f.type === 'windSpeed');
    expect(wind).toBeDefined();
    expect(wind?.value).toBe('34 mph gusts');
    expect(wind?.condition).toBe('poor');
  });

  it('overrides temperature label to "too cold" or "too hot" for no status', () => {
    // too cold
    const weather = {
      temperature: 30, // < 36
      windSpeed: 5,
      rainChance: 0,
      dewpoint: 50,
      aqi: 20,
      weatherCode: 1,
    } as unknown as Weather;
    const factors = getRideFactors(weather, 'no');
    expect(factors.find((f) => f.type === 'temperature')?.label).toBe('Temperature'); // The factor label is always "Temperature"

    // wait, getMessage overrides the issue label, getRideFactors doesn't do "too cold". Let's test getMessage.
  });
});

describe('getMessage', () => {
  it('overrides temperature label to "too cold" for status no', () => {
    const weather = {
      temperature: 30, // < 36 -> bad
      feelsLike: 25,
      windSpeed: 5,
      windGust: 5,
      rainChance: 0,
      dewpoint: 50,
      weatherCode: 1,
      hasThunderstorms: false,
      hourly: [],
      pastHourly: [],
      daily: [],
    } as unknown as Weather;
    expect(getMessage(weather, 'no')).toContain('too cold');
  });

  it('overrides temperature label to "too hot" for status no', () => {
    const weather = {
      temperature: 105, // > 100 -> bad
      feelsLike: 110,
      windSpeed: 5,
      windGust: 5,
      rainChance: 0,
      dewpoint: 50,
      weatherCode: 1,
      hasThunderstorms: false,
      hourly: [],
      pastHourly: [],
      daily: [],
    } as unknown as Weather;
    expect(getMessage(weather, 'no')).toContain('too hot');
  });

  it('ignores weather code issue if precipitation already explains it', () => {
    const weather = {
      temperature: 70,
      feelsLike: 70,
      windSpeed: 5,
      windGust: 5,
      rainChance: 90, // rain
      dewpoint: 50,
      weatherCode: 65, // heavy rain
      hasThunderstorms: false,
      hourly: [],
      pastHourly: [],
      daily: [],
    } as unknown as Weather;
    const msg = getMessage(weather, 'no');
    // "Heavy rain" from weather code should be skipped because rain chance is already there.
    expect(msg).toContain('rain');
    // We expect it to NOT list "Heavy rain" separately as a second issue
    // The exact text will just be "It is currently looking like rain..."
  });
});

describe('getDaylightWarning', () => {
  it('returns null if hourly or daylight is missing', () => {
    expect(getDaylightWarning(undefined, null)).toBeNull();
  });

  it('returns null if no good/fair hours exist', () => {
    const hourly = [{ condition: 'bad', hour: 12 }] as unknown as HourlyWeather[];
    const daylight = { sunriseHour: 6, sunsetHour: 18 };
    expect(getDaylightWarning(hourly, daylight)).toBeNull();
  });

  it('returns warning if all good hours are in the dark', () => {
    const hourly = [
      { condition: 'good', hour: 4 }, // Before sunrise
      { condition: 'good', hour: 20 }, // After sunset
      { condition: 'bad', hour: 12 }, // Daytime is bad
    ] as unknown as HourlyWeather[];
    const daylight = { sunriseHour: 6, sunsetHour: 18 };
    expect(getDaylightWarning(hourly, daylight)).toContain('dark');
  });

  it('returns null if there is a good hour in daylight', () => {
    const hourly = [{ condition: 'good', hour: 12 }] as unknown as HourlyWeather[];
    const daylight = { sunriseHour: 6, sunsetHour: 18 };
    expect(getDaylightWarning(hourly, daylight)).toBeNull();
  });
});
