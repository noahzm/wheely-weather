import { describe, expect, it } from 'vitest';
import { getRideFactors } from './weather';

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
    expect(wind.value).toBe('34 mph gusts');
    expect(wind.condition).toBe('poor');
  });
});
