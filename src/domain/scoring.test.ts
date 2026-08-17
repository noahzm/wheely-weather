import { describe, expect, it } from 'vitest';
import {
  calculateRideScore,
  evaluateCondition,
  evaluateWind,
  getOverallStatus,
  isColdTemp,
} from './weather';

describe('Weather Condition Evaluation', () => {
  // Reproduces the cycling-weather reference zone tables, mapped zone->condition:
  // ideal->good, good->fair, caution->marginal, hard->poor, avoid->bad.
  it('rates air temperature against the reference table', () => {
    expect(evaluateCondition(60, 'temperature')).toBe('good'); // 50-68 ideal
    expect(evaluateCondition(45, 'temperature')).toBe('fair'); // 40-50 good
    expect(evaluateCondition(75, 'temperature')).toBe('fair'); // 68-82 good/fair
    expect(evaluateCondition(85, 'temperature')).toBe('marginal'); // 82-90 caution
    expect(evaluateCondition(35, 'temperature')).toBe('marginal'); // 32-40 caution
    expect(evaluateCondition(92, 'temperature')).toBe('poor'); // 90-95 hard
    expect(evaluateCondition(95, 'temperature')).toBe('bad'); // 95 is the avoid boundary
    expect(evaluateCondition(98, 'temperature')).toBe('bad'); // 95+ avoid
    expect(evaluateCondition(28, 'temperature')).toBe('bad'); // icy avoid
  });

  it('phrases a temperature issue as cold based on air temperature', () => {
    expect(isColdTemp(48)).toBe(true);
    expect(isColdTemp(71)).toBe(false);
    expect(isColdTemp(52)).toBe(false);
  });

  it('rates temperature on air temperature alone, ignoring feels-like', () => {
    // Wind chill / heat index are provider-specific derived values whose signal
    // is already carried by the wind and dewpoint metrics; 80°F air rates fair
    // no matter what either API reports as apparent temperature.
    expect(evaluateCondition(80, 'temperature')).toBe('fair');
    expect(evaluateCondition(45, 'temperature')).toBe('fair');
  });

  it('rates dew point against the reference table', () => {
    expect(evaluateCondition(50, 'dewpoint')).toBe('good'); // <58 ideal
    expect(evaluateCondition(60, 'dewpoint')).toBe('fair'); // 58-66 good
    expect(evaluateCondition(68, 'dewpoint')).toBe('marginal'); // 66-74 caution
    expect(evaluateCondition(75, 'dewpoint')).toBe('poor'); // 74-78 hard
    expect(evaluateCondition(79, 'dewpoint')).toBe('bad'); // 78+ avoid
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
    expect(evaluateCondition(20, 'windGust')).toBe('good');
    expect(evaluateCondition(24, 'windGust')).toBe('fair');
    expect(evaluateCondition(30, 'windGust')).toBe('marginal');
    expect(evaluateCondition(36, 'windGust')).toBe('poor');
    expect(evaluateCondition(42, 'windGust')).toBe('bad');
  });

  it('rates wind on the worse of sustained speed and gusts', () => {
    // Calm sustained wind but strong gusts is still flagged.
    expect(evaluateWind(8, 36)).toBe('poor');
    // Gusts absent -> falls back to sustained-only.
    expect(evaluateWind(20, null)).toBe('marginal');
    // Sustained worse than gusts -> sustained wins.
    expect(evaluateWind(32, 24)).toBe('bad');
  });

  it('evaluates rainChance correctly', () => {
    expect(evaluateCondition(0, 'rainChance')).toBe('good');
    expect(evaluateCondition(25, 'rainChance')).toBe('fair');
    expect(evaluateCondition(45, 'rainChance')).toBe('marginal');
    expect(evaluateCondition(70, 'rainChance')).toBe('poor');
    expect(evaluateCondition(80, 'rainChance')).toBe('bad');
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

  it('returns "yes" when conditions are fair but comfortably rideable', () => {
    const weather = {
      hasThunderstorms: false,
      temperature: 60, // good
      windSpeed: 12, // fair
      rainChance: 0,
      dewpoint: 50,
      aqi: 20,
    };
    expect(getOverallStatus(weather)).toBe('yes');
  });

  it('returns "maybe" when any condition is marginal', () => {
    const weather = {
      hasThunderstorms: false,
      temperature: 60,
      windSpeed: 20, // marginal
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

  it('returns "maybe" for warm weather (85°F air temp)', () => {
    const weather = {
      hasThunderstorms: false,
      temperature: 85,
      feelsLike: 88,
      windSpeed: 5,
      rainChance: 0,
      dewpoint: 63,
      aqi: 20,
    };
    expect(getOverallStatus(weather)).toBe('maybe');
  });

  it('returns "no" for cold rain hypothermia hazard (temp <= 45°F and rain >= 30%)', () => {
    const weather = {
      hasThunderstorms: false,
      temperature: 42,
      feelsLike: 40,
      windSpeed: 10,
      rainChance: 35,
      dewpoint: 38,
      aqi: 20,
    };
    expect(getOverallStatus(weather)).toBe('no');
  });
});

describe('calculateRideScore', () => {
  it('returns high score (9 or 10 out of 10) for ideal riding weather', () => {
    const weather = {
      hasThunderstorms: false,
      temperature: 65,
      windSpeed: 5,
      windGust: 8,
      rainChance: 0,
      dewpoint: 48,
      aqi: 15,
      weatherCode: 0,
    };
    const score = calculateRideScore(weather);
    expect(score).toBeGreaterThanOrEqual(9);
  });

  it('returns very low score (1/10) for thunderstorms', () => {
    const weather = {
      hasThunderstorms: true,
      temperature: 70,
      windSpeed: 10,
      rainChance: 50,
    };
    expect(calculateRideScore(weather)).toBe(1);
  });

  it('never returns a high score when status is "no"', () => {
    const weatherWithOneDealbreaker = {
      hasThunderstorms: false,
      temperature: 65, // ideal
      windSpeed: 35, // bad! (gusts/wind severe)
      rainChance: 0, // ideal
      dewpoint: 50, // ideal
      aqi: 15, // ideal
      weatherCode: 0,
    };
    const score = calculateRideScore(weatherWithOneDealbreaker);
    expect(score).toBeLessThanOrEqual(3);
  });

  it('returns score 8 for a fair rideable day', () => {
    const fairWeather = {
      hasThunderstorms: false,
      temperature: 75, // fair warm
      windSpeed: 14, // fair wind
      rainChance: 25, // fair rain
      dewpoint: 62, // fair dew
      aqi: 15,
      weatherCode: 0,
    };
    const score = calculateRideScore(fairWeather);
    expect(score).toBe(8);
  });

  it('returns score between 4 and 6 for a maybe day', () => {
    const maybeWeather = {
      hasThunderstorms: false,
      temperature: 85, // marginal heat
      feelsLike: 88,
      windSpeed: 5,
      rainChance: 0,
      dewpoint: 63,
      aqi: 15,
      weatherCode: 0,
    };
    const score = calculateRideScore(maybeWeather);
    expect(score).toBeGreaterThanOrEqual(4);
    expect(score).toBeLessThanOrEqual(6);
  });
});
