import { THRESHOLDS, COLD_RAIN_HAZARD, type Thresholds } from './constants';
import { getWeatherCodeCondition } from './weather-codes';

import { fullHourLabel } from '../utils/timeFormat';

import type { Condition, HourlyWeather, MetricType, RideStatus, Weather } from '@/types/weather';

interface UpperBoundThresholds {
  BAD: number;
  POOR: number;
  MARGINAL: number;
  FAIR: number;
}

interface ComfortBandThresholds {
  BAD_MIN: number;
  BAD_MAX: number;
  POOR_MIN: number;
  POOR_MAX: number;
  MARGINAL_MIN: number;
  MARGINAL_MAX: number;
  FAIR_MIN: number;
  FAIR_MAX: number;
}

export const RANK: Record<Condition, number> = {
  bad: 0,
  poor: 1,
  marginal: 2,
  fair: 3,
  good: 4,
};

/** Rates a "higher is worse" metric against ascending bad→fair thresholds. */
const rateUpperBound = (value: number, t: UpperBoundThresholds): Condition => {
  if (value > t.BAD) return 'bad';
  if (value > t.POOR) return 'poor';
  if (value > t.MARGINAL) return 'marginal';
  if (value > t.FAIR) return 'fair';
  return 'good';
};

/**
 * Rates a two-sided "comfortable band" metric (e.g. feels-like temperature)
 * where both too-low and too-high degrade the rating.
 */
const rateComfortBand = (value: number, t: ComfortBandThresholds): Condition => {
  if (value < t.BAD_MIN || value > t.BAD_MAX) return 'bad';
  if (value < t.POOR_MIN || value > t.POOR_MAX) return 'poor';
  if (value < t.MARGINAL_MIN || value > t.MARGINAL_MAX) return 'marginal';
  if (value < t.FAIR_MIN || value > t.FAIR_MAX) return 'fair';
  return 'good';
};

/**
 * Resolves the temperature a rating is actually taken on: wind chill governs the
 * cold end (<= 50°F) and heat index the warm end (>= 70°F), while the temperate
 * middle rates on air temperature alone. Callers that *label* a temperature issue
 * must format this value rather than the raw air temperature, or the chip names a
 * number that didn't drive its own severity ("Freezing (48°)" for 48°F air at a
 * 30°F wind chill).
 */
export const effectiveRideTemp = (temp: number, feelsLike?: number | null): number => {
  if (feelsLike == null) return temp;
  if (temp <= 50) return Math.min(temp, feelsLike);
  if (temp >= 70) return Math.max(temp, feelsLike);
  return temp;
};

/** True when a temperature issue should be phrased as cold rather than heat. */
export const isColdTemp = (temp: number, feelsLike?: number | null): boolean =>
  effectiveRideTemp(temp, feelsLike) < 50;

/**
 * Evaluates a single weather metric against cycling-friendly thresholds.
 * Returns "good", "fair", "marginal", "poor", or "bad" to indicate ride-ability.
 * `thresholds` defaults to the base set; pass an acclimatization-adjusted set to
 * shift the comfort dials for a rider's home climate.
 * `feelsLike` is factored in for cold temperatures (<= 50°F) to reflect wind chill,
 * and for warm temperatures (>= 70°F) to reflect heat index / apparent temperature.
 */
export const evaluateCondition = (
  value: number | null | undefined,
  type: MetricType,
  thresholds: Thresholds = THRESHOLDS,
  feelsLike?: number | null,
): Condition => {
  if (value == null) return 'good';
  const T = thresholds;
  switch (type) {
    case 'temperature': {
      return rateComfortBand(effectiveRideTemp(value, feelsLike), T.TEMPERATURE);
    }
    case 'windSpeed': {
      return rateUpperBound(value, T.WIND_SPEED);
    }
    case 'windGust': {
      return rateUpperBound(value, T.WIND_GUST);
    }
    case 'rainChance': {
      return rateUpperBound(value, T.RAIN_CHANCE);
    }
    case 'aqi': {
      return rateUpperBound(value, T.AQI);
    }
    case 'dewpoint': {
      return rateUpperBound(value, T.DEWPOINT);
    }
    case 'uv': {
      return rateUpperBound(value, T.UV_INDEX);
    }
    case 'humidity': {
      return rateUpperBound(value, T.HUMIDITY);
    }
    default: {
      return 'good';
    }
  }
};

/** Returns the worse of two ratings (lower RANK = worse). */
const worseCondition = (a: Condition, b: Condition): Condition => (RANK[a] <= RANK[b] ? a : b);

/**
 * Rates wind on the worse of sustained speed and gusts. Gusts are what actually
 * destabilize a rider, so a calm-but-gusty hour is still flagged. Falls back to
 * sustained-only when gust data is unavailable (e.g. non-US/secondary sources).
 */
export const evaluateWind = (
  windSpeed: number,
  windGust: number | null | undefined,
  thresholds: Thresholds = THRESHOLDS,
): Condition => {
  const sustained = evaluateCondition(windSpeed, 'windSpeed', thresholds);
  if (windGust == null) return sustained;
  return worseCondition(sustained, evaluateCondition(windGust, 'windGust', thresholds));
};

/** True when gusts are a strictly worse limiter than sustained wind. */
export const isGustDriven = (windSpeed: number, windGust: number | null | undefined): boolean =>
  windGust != null &&
  RANK[evaluateCondition(windGust, 'windGust')] < RANK[evaluateCondition(windSpeed, 'windSpeed')];

/**
 * Evaluates the combined cold + rain hypothermia hazard.
 * Cold exposure under 45°F combined with rain is disproportionately dangerous for cyclists.
 */
export const evaluateColdRainHazard = (
  temp: number | null | undefined,
  rainChance: number | null | undefined,
  code?: number | null,
): Condition | null => {
  if (temp == null) return null;
  const isRainCode =
    code != null && [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code);
  const isRainLikely = (rainChance ?? 0) >= COLD_RAIN_HAZARD.MIN_RAIN_CHANCE || isRainCode;

  if (temp <= COLD_RAIN_HAZARD.MAX_TEMP && isRainLikely) {
    if (temp <= COLD_RAIN_HAZARD.SEVERE_TEMP) return 'bad';
    return 'poor';
  }
  return null;
};

/** Determines the overall cycling verdict. */
export const getOverallStatus = (
  weather: Weather,
  thresholds: Thresholds = THRESHOLDS,
): RideStatus => {
  if (weather.hasThunderstorms) return 'no';
  const coldRainCondition = evaluateColdRainHazard(
    weather.temperature,
    weather.rainChance,
    weather.weatherCode,
  );
  const conditions = [
    evaluateCondition(weather.temperature, 'temperature', thresholds, weather.feelsLike),
    evaluateWind(weather.windSpeed, weather.windGust, thresholds),
    evaluateCondition(weather.rainChance, 'rainChance', thresholds),
    evaluateCondition(weather.dewpoint, 'dewpoint', thresholds),
    getWeatherCodeCondition(weather.weatherCode),
    ...(weather.aqi == null ? [] : [evaluateCondition(weather.aqi, 'aqi', thresholds)]),
    ...(coldRainCondition ? [coldRainCondition] : []),
  ];
  if (conditions.some((c) => c === 'bad' || c === 'poor')) return 'no';
  if (conditions.includes('marginal')) return 'maybe';
  return 'yes';
};

const getCyclingCondition = (conditions: Condition[]): Condition => {
  if (conditions.includes('bad')) return 'bad';
  if (conditions.includes('poor')) return 'poor';
  if (conditions.includes('marginal')) return 'marginal';
  if (conditions.includes('fair')) return 'fair';
  return 'good';
};

interface HourlyConditionInput {
  temperature: number;
  feelsLike?: number | null;
  wind: number;
  gust?: number | null;
  rain: number;
  code?: number | null;
  dewpoint: number | null;
}

/** UV is intentionally excluded — it drives sunscreen/kit advice, not ride-ability. */
export const getHourlyCondition = (
  { temperature, feelsLike, wind, gust, rain, code, dewpoint }: HourlyConditionInput,
  thresholds: Thresholds = THRESHOLDS,
): Condition => {
  const coldRainCondition = evaluateColdRainHazard(temperature, rain, code);
  return getCyclingCondition([
    evaluateCondition(temperature, 'temperature', thresholds, feelsLike),
    evaluateWind(wind, gust, thresholds),
    evaluateCondition(rain, 'rainChance', thresholds),
    evaluateCondition(dewpoint, 'dewpoint', thresholds),
    getWeatherCodeCondition(code),
    ...(coldRainCondition ? [coldRainCondition] : []),
  ]);
};

interface DailyConditionInput {
  tempLow?: number | null;
  tempHigh?: number | null;
  wind: number;
  gust?: number | null;
  rain: number;
  code?: number | null;
  dewpoint?: number | null;
}

// `tempLow`/`tempHigh` are the coldest and warmest air temperature during the
// day's daylight (ridable) hours; temperature is rated on whichever is worse.
// This keeps the daily verdict consistent with wind/rain/dew (worst-case during
// ridable hours) instead of rating temp on the warmest moment alone. Either bound
// may be omitted.
/** UV is intentionally excluded — it drives sunscreen/kit advice, not ride-ability. */
export const getDailyCondition = (
  { tempLow = null, tempHigh, wind, gust = null, rain, code, dewpoint = null }: DailyConditionInput,
  thresholds: Thresholds = THRESHOLDS,
): Condition => {
  const effectiveColdTemp = tempLow ?? tempHigh;
  const coldRainCondition = evaluateColdRainHazard(effectiveColdTemp, rain, code);
  return getCyclingCondition([
    ...(tempLow == null ? [] : [evaluateCondition(tempLow, 'temperature', thresholds)]),
    ...(tempHigh == null ? [] : [evaluateCondition(tempHigh, 'temperature', thresholds)]),
    evaluateWind(wind, gust, thresholds),
    evaluateCondition(rain, 'rainChance', thresholds),
    getWeatherCodeCondition(code),
    ...(dewpoint == null ? [] : [evaluateCondition(dewpoint, 'dewpoint', thresholds)]),
    ...(coldRainCondition ? [coldRainCondition] : []),
  ]);
};

/** Finds the next clearly better ride window, even if it improves to fair rather than perfect. */
export function getLaterGoodHour(hourly: HourlyWeather[] | undefined): string | null {
  if (!hourly || hourly.length < 2) return null;

  const first = hourly[0];
  if (!first) return null;
  const currentRank = RANK[first.condition];

  for (let i = 1; i < hourly.length; i++) {
    const next = hourly[i];
    if (!next) continue;
    const nextRank = RANK[next.condition];
    if (nextRank >= RANK.fair && nextRank > currentRank) {
      return fullHourLabel(next.hour);
    }
  }

  return null;
}

const CONDITION_SCORES: Record<Condition, number> = {
  good: 100,
  fair: 82,
  marginal: 60,
  poor: 35,
  bad: 10,
};

/**
 * Calculates a quantitative Ride Quality Index (0–100) based on weather metrics.
 * Bounded by overall status so the score never contradicts the plain-language verdict.
 */
export function calculateRideScore(weather: Weather, thresholds: Thresholds = THRESHOLDS): number {
  if (weather.hasThunderstorms) return 1;

  const tempCond = evaluateCondition(
    weather.temperature,
    'temperature',
    thresholds,
    weather.feelsLike,
  );
  const windCond = evaluateWind(weather.windSpeed, weather.windGust, thresholds);
  const rainCond = evaluateCondition(weather.rainChance, 'rainChance', thresholds);
  const dewCond = evaluateCondition(weather.dewpoint, 'dewpoint', thresholds);
  const codeCond = getWeatherCodeCondition(weather.weatherCode);
  const aqiCond = weather.aqi == null ? 'good' : evaluateCondition(weather.aqi, 'aqi', thresholds);

  const coldRainCond = evaluateColdRainHazard(
    weather.temperature,
    weather.rainChance,
    weather.weatherCode,
  );

  const allConditions = [
    tempCond,
    windCond,
    rainCond,
    dewCond,
    codeCond,
    aqiCond,
    ...(coldRainCond ? [coldRainCond] : []),
  ];

  const overallStatus = getOverallStatus(weather, thresholds);

  const weighted =
    CONDITION_SCORES[tempCond] * 0.25 +
    CONDITION_SCORES[windCond] * 0.25 +
    CONDITION_SCORES[rainCond] * 0.3 +
    ((CONDITION_SCORES[dewCond] + CONDITION_SCORES[aqiCond]) / 2) * 0.1 +
    CONDITION_SCORES[codeCond] * 0.1;

  const minConditionScore = Math.min(...allConditions.map((c) => CONDITION_SCORES[c]));
  let score100 = Math.round(weighted * 0.6 + minConditionScore * 0.4);

  // Strict caps aligned with overall status so score NEVER contradicts the verdict
  if (overallStatus === 'no') {
    const noCap = allConditions.includes('bad') || coldRainCond === 'bad' ? 19 : 39;
    score100 = Math.min(score100, noCap);
  } else if (overallStatus === 'maybe') {
    score100 = Math.max(40, Math.min(69, score100));
  } else {
    score100 = Math.max(70, Math.min(100, score100));
  }

  // Scale 0–100 down to a clean 0–10 integer score
  return Math.max(0, Math.min(10, Math.floor(score100 / 10)));
}
