import { describe, expect, it } from 'vitest';
import { evaluateCondition, evaluateWind, getOverallStatus } from './weather';

describe('Weather Condition Evaluation', () => {
  // Reproduces the cycling-weather reference zone tables, mapped zone->condition:
  // ideal->good, good->fair, caution->marginal, hard->poor, avoid->bad.
  it('rates air temperature against the reference table', () => {
    expect(evaluateCondition(60, 'temperature')).toBe('good'); // 50-68 ideal
    expect(evaluateCondition(45, 'temperature')).toBe('fair'); // 40-50 good
    expect(evaluateCondition(75, 'temperature')).toBe('fair'); // 68-85 good
    expect(evaluateCondition(35, 'temperature')).toBe('marginal'); // 32-40 caution
    expect(evaluateCondition(90, 'temperature')).toBe('poor'); // 85-95 hard
    expect(evaluateCondition(98, 'temperature')).toBe('bad'); // 95+ avoid
    expect(evaluateCondition(28, 'temperature')).toBe('bad'); // icy avoid
  });

  it('rates dew point against the reference table', () => {
    expect(evaluateCondition(50, 'dewpoint')).toBe('good'); // <55 ideal
    expect(evaluateCondition(57, 'dewpoint')).toBe('fair'); // 55-60 good
    expect(evaluateCondition(62, 'dewpoint')).toBe('marginal'); // 60-65 caution
    expect(evaluateCondition(68, 'dewpoint')).toBe('poor'); // 65-75 hard
    expect(evaluateCondition(78, 'dewpoint')).toBe('bad'); // 75+ avoid
  });

  it('rates sustained wind against the reference table', () => {
    expect(evaluateCondition(5, 'windSpeed')).toBe('good'); // <10 ideal
    expect(evaluateCondition(12, 'windSpeed')).toBe('fair'); // 10-15 good
    expect(evaluateCondition(20, 'windSpeed')).toBe('marginal'); // 15-25 caution
    expect(evaluateCondition(28, 'windSpeed')).toBe('poor'); // 25-30 hard
    expect(evaluateCondition(32, 'windSpeed')).toBe('bad'); // 30+ avoid
  });

  it('rates AQI against the reference table', () => {
    expect(evaluateCondition(20, 'aqi')).toBe('good'); // 0-50 ideal
    expect(evaluateCondition(80, 'aqi')).toBe('fair'); // 51-100 good
    expect(evaluateCondition(120, 'aqi')).toBe('marginal'); // 101-150 caution
    expect(evaluateCondition(180, 'aqi')).toBe('poor'); // 151-200 hard
    expect(evaluateCondition(220, 'aqi')).toBe('bad'); // 201+ avoid
  });

  it('rates UV index against the reference table', () => {
    expect(evaluateCondition(1, 'uv')).toBe('good'); // 0-2 ideal
    expect(evaluateCondition(4, 'uv')).toBe('fair'); // 3-5 good
    expect(evaluateCondition(6, 'uv')).toBe('marginal'); // 6-7 caution
    expect(evaluateCondition(9, 'uv')).toBe('poor'); // 8-10 hard
    expect(evaluateCondition(11, 'uv')).toBe('bad'); // 11+ avoid
  });

  it('evaluates windGust on its own (higher) thresholds', () => {
    expect(evaluateCondition(18, 'windGust')).toBe('good');
    expect(evaluateCondition(22, 'windGust')).toBe('fair');
    expect(evaluateCondition(28, 'windGust')).toBe('marginal');
    expect(evaluateCondition(34, 'windGust')).toBe('poor');
    expect(evaluateCondition(40, 'windGust')).toBe('bad');
  });

  it('rates wind on the worse of sustained speed and gusts', () => {
    // Calm sustained wind but strong gusts is still flagged.
    expect(evaluateWind(8, 34)).toBe('poor');
    // Gusts absent -> falls back to sustained-only.
    expect(evaluateWind(20, null)).toBe('marginal');
    // Sustained worse than gusts -> sustained wins.
    expect(evaluateWind(32, 24)).toBe('bad');
  });

  it('evaluates rainChance correctly', () => {
    expect(evaluateCondition(0, 'rainChance')).toBe('good');
    expect(evaluateCondition(20, 'rainChance')).toBe('fair');
    expect(evaluateCondition(35, 'rainChance')).toBe('marginal');
    expect(evaluateCondition(50, 'rainChance')).toBe('poor');
    expect(evaluateCondition(70, 'rainChance')).toBe('bad');
  });
});

describe('Overall Status Determination', () => {
  it('returns "no" for thunderstorms', () => {
    const weather = { hasThunderstorms: true };
    expect(getOverallStatus(weather)).toBe('no');
  });

  it('returns "no" if any condition is "bad" or "poor"', () => {
    const weather = {
      hasThunderstorms: false,
      temperature: 28, // bad (icy)
      windSpeed: 5,
      rainChance: 0,
      dewpoint: 50,
      aqi: 20,
    };
    expect(getOverallStatus(weather)).toBe('no');
  });

  it('returns "no" when the weather code is severe even if raw metrics look fine', () => {
    const weather = {
      hasThunderstorms: false,
      temperature: 60,
      windSpeed: 5,
      rainChance: 10, // below marginal threshold
      dewpoint: 50,
      aqi: 20,
      weatherCode: 65, // heavy rain
    };
    expect(getOverallStatus(weather)).toBe('no');
  });

  it('ignores UV for the verdict — it only drives sunscreen/kit advice', () => {
    const weather = {
      hasThunderstorms: false,
      temperature: 60,
      windSpeed: 5,
      rainChance: 0,
      dewpoint: 50,
      aqi: 20,
      uvIndex: 11, // extreme, but not a ride gate
    };
    expect(getOverallStatus(weather)).toBe('yes');
  });

  it('returns "maybe" if conditions are "marginal" or "fair"', () => {
    const weather = {
      hasThunderstorms: false,
      temperature: 60, // good
      windSpeed: 12, // fair
      rainChance: 0,
      dewpoint: 50,
      aqi: 20,
    };
    expect(getOverallStatus(weather)).toBe('maybe');
  });

  it('returns "yes" if all conditions are "good"', () => {
    const weather = {
      hasThunderstorms: false,
      temperature: 60,
      windSpeed: 5,
      rainChance: 0,
      dewpoint: 50,
      aqi: 20,
      uvIndex: 1,
    };
    expect(getOverallStatus(weather)).toBe('yes');
  });
});
