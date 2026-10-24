import { describe, expect, it } from 'vitest';
import { resolveThresholds } from './acclimatization';
import { THRESHOLDS } from './constants';
import {
  evaluateColdRainHazard,
  evaluateHeatIndexHazard,
  getCurrentCondition,
  getDailyCondition,
  getHourlyCondition,
  getLimitingHeatIndex,
  getOverallCondition,
} from './scoring';
import {
  calculateRideScore,
  evaluateCondition,
  evaluateRain,
  evaluateWind,
  getOverallStatus,
  isColdTemp,
} from './weather';
import { makeWeather } from '@/test-utils/weather';

describe('Weather Condition Evaluation', () => {
  // Reproduces the cycling-weather reference zone tables, mapped zone->condition:
  // ideal->good, good->fair, caution->marginal, hard->poor, avoid->bad.
  it('rates air temperature against the reference table', () => {
    expect(evaluateCondition(60, 'temperature')).toBe('good'); // 50-75 ideal
    expect(evaluateCondition(74, 'temperature')).toBe('good'); // low 70s count as ideal
    expect(evaluateCondition(45, 'temperature')).toBe('fair'); // 40-50 good
    expect(evaluateCondition(78, 'temperature')).toBe('fair'); // 75-82 good/fair
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
    const weather = makeWeather({ hasThunderstorms: true });
    expect(getOverallStatus(weather)).toBe('no');
  });

  it('returns "no" if any condition is "bad" or "poor"', () => {
    const weather = makeWeather({
      hasThunderstorms: false,
      temperature: 28, // bad (icy)
      windSpeed: 5,
      rainChance: 0,
      dewpoint: 50,
      aqi: 20,
    });
    expect(getOverallStatus(weather)).toBe('no');
  });

  it('returns "no" when the weather code is severe even if raw metrics look fine', () => {
    const weather = makeWeather({
      hasThunderstorms: false,
      temperature: 60,
      windSpeed: 5,
      rainChance: 10, // below marginal threshold
      dewpoint: 50,
      aqi: 20,
      weatherCode: 65, // heavy rain
    });
    expect(getOverallStatus(weather)).toBe('no');
  });

  it('ignores UV for the verdict — it only drives sunscreen/kit advice', () => {
    const weather = makeWeather({
      hasThunderstorms: false,
      temperature: 60,
      windSpeed: 5,
      rainChance: 0,
      dewpoint: 50,
      aqi: 20,
      uvIndex: 11, // extreme, but not a ride gate
    });
    expect(getOverallStatus(weather)).toBe('yes');
  });

  it('returns "yes" when conditions are fair but comfortably rideable', () => {
    const weather = makeWeather({
      hasThunderstorms: false,
      temperature: 60, // good
      windSpeed: 12, // fair
      rainChance: 0,
      dewpoint: 50,
      aqi: 20,
    });
    expect(getOverallStatus(weather)).toBe('yes');
  });

  it('returns "maybe" when any condition is marginal', () => {
    const weather = makeWeather({
      hasThunderstorms: false,
      temperature: 60,
      windSpeed: 20, // marginal
      rainChance: 0,
      dewpoint: 50,
      aqi: 20,
    });
    expect(getOverallStatus(weather)).toBe('maybe');
  });

  it('returns "yes" if all conditions are "good"', () => {
    const weather = makeWeather({
      hasThunderstorms: false,
      temperature: 60,
      windSpeed: 5,
      rainChance: 0,
      dewpoint: 50,
      aqi: 20,
      uvIndex: 1,
    });
    expect(getOverallStatus(weather)).toBe('yes');
  });

  it('returns "maybe" for warm weather (85°F air temp)', () => {
    const weather = makeWeather({
      hasThunderstorms: false,
      temperature: 85,
      feelsLike: 88,
      windSpeed: 5,
      rainChance: 0,
      dewpoint: 63,
      aqi: 20,
    });
    expect(getOverallStatus(weather)).toBe('maybe');
  });

  it('returns "no" for cold rain hypothermia hazard (temp <= 45°F and rain >= 40%)', () => {
    const weather = makeWeather({
      hasThunderstorms: false,
      temperature: 42,
      feelsLike: 40,
      windSpeed: 10,
      rainChance: 45,
      dewpoint: 38,
      aqi: 20,
    });
    expect(getOverallStatus(weather)).toBe('no');
    // Below the trigger, a cool damp day is a judgment call, not a hazard.
    expect(getOverallStatus({ ...weather, rainChance: 35 })).not.toBe('no');
  });
});

// A Gulf Coast rider out most days: the climate adjustment's full heat and
// humidity shift (heat bands +7°F, dew point bands up to 76/77°F).
const gulfRider = resolveThresholds(
  { warmTemp: 95, warmDewpoint: 76, coolTemp: 60 },
  THRESHOLDS,
  'high',
);

describe('heat index hazard', () => {
  it('rates poor from a 103°F heat index', () => {
    expect(evaluateHeatIndexHazard(103)).toBe('poor');
    expect(evaluateHeatIndexHazard(102.9)).toBeNull();
    expect(evaluateHeatIndexHazard(null)).toBeNull();
  });

  it('makes muggy heat a no-go for an acclimatized rider whose bands rate it maybe', () => {
    // 94°F with a 74°F dew point: hot and fair for this rider apart, 105°F together.
    const muggy = makeWeather({ temperature: 94, dewpoint: 74 });
    expect(getOverallCondition(muggy, gulfRider)).toBe('poor');
    expect(getHourlyCondition({ temperature: 94, wind: 5, rain: 0, dewpoint: 74 }, gulfRider)).toBe(
      'poor',
    );
    // 90°F with the same dew point is a 99°F heat index: still maybe.
    expect(getOverallCondition({ ...muggy, temperature: 90 }, gulfRider)).toBe('marginal');
  });

  it('changes nothing for a standard rider, whose bands already catch it', () => {
    expect(getOverallCondition(makeWeather({ temperature: 90, dewpoint: 74 }))).toBe('marginal');
    expect(getOverallCondition(makeWeather({ temperature: 92, dewpoint: 76 }))).toBe('poor');
  });

  it('rates a day on the window’s hourly peak when it has one', () => {
    const day = { tempHigh: 94, dewpoint: 74, wind: 5, rain: 0 };
    // The hottest hour and the muggiest needn't coincide: paired, they overstate it.
    expect(getDailyCondition(day, gulfRider)).toBe('poor');
    expect(getDailyCondition({ ...day, heatIndex: 99 }, gulfRider)).toBe('marginal');
  });

  it('caps the score at a no-go', () => {
    expect(calculateRideScore(makeWeather({ temperature: 94, dewpoint: 74 }), gulfRider)).toBe(3);
  });

  it('is named only when heat and humidity alone don’t already make it a no-go', () => {
    expect(getLimitingHeatIndex({ index: 105, temp: 94, dewpoint: 74 }, gulfRider)).toBe(105);
    // A standard rider: 92°F is already very hot and says so.
    expect(getLimitingHeatIndex({ index: 105, temp: 92, dewpoint: 76 })).toBeNull();
    expect(getLimitingHeatIndex({ index: 99, temp: 90, dewpoint: 74 }, gulfRider)).toBeNull();
  });
});

describe('evaluateColdRainHazard', () => {
  it('ignores a likely trace, unless the sky says it is raining', () => {
    expect(evaluateColdRainHazard({ temp: 38, rainChance: 60, precip: 0.1 })).toBeNull();
    expect(evaluateColdRainHazard({ temp: 38, rainChance: 60, precip: 0.1, code: 51 })).toBe('bad');
    expect(evaluateColdRainHazard({ temp: 38, rainChance: 60, precip: 0.5 })).toBe('bad');
    // An unknown amount keeps the chance-based rule.
    expect(evaluateColdRainHazard({ temp: 43, rainChance: 60 })).toBe('poor');
  });

  it('treats a chance below freezing as snow, which its code rates', () => {
    expect(evaluateColdRainHazard({ temp: 28, rainChance: 70 })).toBeNull();
    expect(evaluateColdRainHazard({ temp: 28, rainChance: 70, code: 71 })).toBeNull();
    // Freezing rain still counts, and freezing itself is still cold rain.
    expect(evaluateColdRainHazard({ temp: 28, rainChance: 70, code: 66 })).toBe('bad');
    expect(evaluateColdRainHazard({ temp: 32, rainChance: 70 })).toBe('bad');
  });

  it('stays out of the way above 45°F', () => {
    expect(evaluateColdRainHazard({ temp: 46, rainChance: 90, code: 63 })).toBeNull();
    expect(evaluateColdRainHazard({ temp: null, rainChance: 90 })).toBeNull();
  });
});

describe('calculateRideScore', () => {
  it('returns high score (9 or 10 out of 10) for ideal riding weather', () => {
    const weather = makeWeather({
      hasThunderstorms: false,
      temperature: 65,
      windSpeed: 5,
      windGust: 8,
      rainChance: 0,
      dewpoint: 48,
      aqi: 15,
      weatherCode: 0,
    });
    const score = calculateRideScore(weather);
    expect(score).toBeGreaterThanOrEqual(9);
  });

  it('returns very low score (1/10) for thunderstorms', () => {
    const weather = makeWeather({
      hasThunderstorms: true,
      temperature: 70,
      windSpeed: 10,
      rainChance: 50,
    });
    expect(calculateRideScore(weather)).toBe(1);
  });

  it('never returns a high score when status is "no"', () => {
    const weatherWithOneDealbreaker = makeWeather({
      hasThunderstorms: false,
      temperature: 65, // ideal
      windSpeed: 35, // bad! (gusts/wind severe)
      rainChance: 0, // ideal
      dewpoint: 50, // ideal
      aqi: 15, // ideal
      weatherCode: 0,
    });
    const score = calculateRideScore(weatherWithOneDealbreaker);
    expect(score).toBeLessThanOrEqual(3);
  });

  it('returns score 8 for a fair rideable day', () => {
    const fairWeather = makeWeather({
      hasThunderstorms: false,
      temperature: 75, // fair warm
      windSpeed: 14, // fair wind
      rainChance: 25, // fair rain
      dewpoint: 62, // fair dew
      aqi: 15,
      weatherCode: 0,
    });
    const score = calculateRideScore(fairWeather);
    expect(score).toBe(8);
  });

  it('returns score between 4 and 6 for a maybe day', () => {
    const maybeWeather = makeWeather({
      hasThunderstorms: false,
      temperature: 85, // marginal heat
      feelsLike: 88,
      windSpeed: 5,
      rainChance: 0,
      dewpoint: 63,
      aqi: 15,
      weatherCode: 0,
    });
    const score = calculateRideScore(maybeWeather);
    expect(score).toBeGreaterThanOrEqual(4);
    expect(score).toBeLessThanOrEqual(6);
  });
});

describe('Rain amount', () => {
  it('rates on chance alone when the amount is unknown', () => {
    expect(evaluateRain(80, null)).toBe('bad');
  });

  it('caps a likely trace amount at fair and likely light rain at marginal', () => {
    expect(evaluateRain(70, 0.1)).toBe('fair');
    expect(evaluateRain(80, 0.6)).toBe('marginal');
    expect(evaluateRain(80, 2.5)).toBe('bad');
  });

  it('caps near-certain trace rain at marginal, not fair', () => {
    expect(evaluateRain(75, 0.1)).toBe('marginal');
    expect(evaluateRain(92, 0.15)).toBe('marginal');
    expect(evaluateRain(74, 0.15)).toBe('fair');
  });

  it('never makes a low chance worse because of the amount', () => {
    expect(evaluateRain(10, 4)).toBe('good');
    expect(evaluateRain(30, 0.1)).toBe('fair');
  });

  it('keeps a likely trace shower from forcing a rest day', () => {
    const weather = makeWeather({
      hasThunderstorms: false,
      temperature: 65,
      feelsLike: 65,
      windSpeed: 6,
      rainChance: 70,
      dewpoint: 50,
      aqi: 20,
    });
    expect(getOverallStatus({ ...weather, precipitation: 3 })).toBe('no');
    expect(getOverallStatus({ ...weather, precipitation: 0.5 })).toBe('maybe');
    expect(getOverallStatus({ ...weather, precipitation: 0.1 })).toBe('yes');
  });
});

describe('getCurrentCondition', () => {
  const clear = makeWeather({
    temperature: 68,
    feelsLike: 68,
    windSpeed: 5,
    windGust: null,
    rainChance: 10,
    weatherCode: 1,
    hasThunderstorms: false,
    condition: 'Mostly clear',
    dewpoint: 50,
    aqi: 20,
    hourly: [],
    pastHourly: [],
    daily: [],
  });

  it('matches the overall rating when nothing is falling', () => {
    expect(getCurrentCondition(clear)).toBe(getOverallCondition(clear));
    expect(getCurrentCondition(clear)).toBe('good');
  });

  it('caps light rain falling right now at marginal, which a forecast rates fair', () => {
    for (const code of [51, 53, 61, 80]) {
      const raining = { ...clear, weatherCode: code };
      expect(getOverallCondition(raining)).toBe('fair');
      expect(getCurrentCondition(raining)).toBe('marginal');
    }
  });

  it('never lifts a worse rating', () => {
    const stormy = { ...clear, weatherCode: 61, windSpeed: 30 };
    expect(getCurrentCondition(stormy)).toBe(getOverallCondition(stormy));
    expect(['poor', 'bad']).toContain(getCurrentCondition(stormy));
  });
});
