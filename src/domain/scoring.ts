import { THRESHOLDS, type Thresholds } from './constants';
import { getWeatherCodeCondition } from './weather-codes';

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
 * Evaluates a single weather metric against cycling-friendly thresholds.
 * Returns "good", "fair", "marginal", "poor", or "bad" to indicate ride-ability.
 * `thresholds` defaults to the base set; pass an acclimatization-adjusted set to
 * shift the comfort dials for a rider's home climate.
 */
export const evaluateCondition = (
  value: number | null | undefined,
  type: MetricType,
  thresholds: Thresholds = THRESHOLDS,
): Condition => {
  if (value == null) return 'good';
  const T = thresholds;
  switch (type) {
    case 'temperature': {
      return rateComfortBand(value, T.TEMPERATURE);
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

/** Determines the overall cycling verdict. */
export const getOverallStatus = (
  weather: Weather,
  thresholds: Thresholds = THRESHOLDS,
): RideStatus => {
  if (weather.hasThunderstorms) return 'no';
  const conditions = [
    evaluateCondition(weather.temperature, 'temperature', thresholds),
    evaluateWind(weather.windSpeed, weather.windGust, thresholds),
    evaluateCondition(weather.rainChance, 'rainChance', thresholds),
    evaluateCondition(weather.dewpoint, 'dewpoint', thresholds),
    getWeatherCodeCondition(weather.weatherCode),
    ...(weather.aqi == null ? [] : [evaluateCondition(weather.aqi, 'aqi', thresholds)]),
  ];
  if (conditions.some((c) => c === 'bad' || c === 'poor')) return 'no';
  if (conditions.some((c) => c === 'marginal' || c === 'fair')) return 'maybe';
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
  wind: number;
  gust?: number | null;
  rain: number;
  code?: number | null;
  dewpoint: number | null;
}

/** UV is intentionally excluded — it drives sunscreen/kit advice, not ride-ability. */
export const getHourlyCondition = (
  { temperature, wind, gust, rain, code, dewpoint }: HourlyConditionInput,
  thresholds: Thresholds = THRESHOLDS,
): Condition => {
  return getCyclingCondition([
    evaluateCondition(temperature, 'temperature', thresholds),
    evaluateWind(wind, gust, thresholds),
    evaluateCondition(rain, 'rainChance', thresholds),
    evaluateCondition(dewpoint, 'dewpoint', thresholds),
    getWeatherCodeCondition(code),
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
  return getCyclingCondition([
    ...(tempLow == null ? [] : [evaluateCondition(tempLow, 'temperature', thresholds)]),
    ...(tempHigh == null ? [] : [evaluateCondition(tempHigh, 'temperature', thresholds)]),
    evaluateWind(wind, gust, thresholds),
    evaluateCondition(rain, 'rainChance', thresholds),
    getWeatherCodeCondition(code),
    ...(dewpoint == null ? [] : [evaluateCondition(dewpoint, 'dewpoint', thresholds)]),
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
      return formatHour(next.hour);
    }
  }

  return null;
}

export function formatHour(h: number): string {
  const hour = h % 24;
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}
