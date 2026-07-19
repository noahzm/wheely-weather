import { THRESHOLDS, type Thresholds } from './constants';
import { STATUS_MESSAGES as MSG, ISSUE_PHRASES, RAIN_MESSAGES, DAYLIGHT_MESSAGES } from './copy';
import { evaluateCondition, evaluateWind, getLaterGoodHour, isGustDriven, RANK } from './scoring';
import {
  getWeatherCodeCondition,
  getWeatherCodeIssue,
  getWeatherDescription,
} from './weather-codes';

import { fullHourLabel } from '../utils/timeFormat';
import { formatTemperature, type TempUnit } from '../utils/temperature';
import { formatPercent } from '../utils/percent';

import type {
  Condition,
  DaylightWindow,
  HourlyWeather,
  MetricType,
  RideFactor,
  RideStatus,
  VerdictMessage,
  Weather,
} from '@/types/weather';

/** Collapses a condition rating to the shared issue-phrase tier. */
const issueTier = (rating: Condition): 'bad' | 'poor' | 'marginal' => {
  if (rating === 'bad') return 'bad';
  if (rating === 'poor') return 'poor';
  return 'marginal';
};

/**
 * Collects the limiting-factor labels to mention in the verdict, in insertion
 * order (temp → wind → rain → weather → dewpoint → AQI). Phrasing comes from
 * the shared ISSUE_PHRASES table so the hero chips and the hourly chart drawer
 * describe the same metric with the same words.
 */
const collectMessageIssues = (
  weather: Weather,
  status: RideStatus,
  thresholds: Thresholds,
  tempUnit: TempUnit = 'fahrenheit',
): string[] => {
  const issues: string[] = [];
  const addIssue = (
    val: number | null | undefined,
    type: MetricType,
    label: (tier: 'bad' | 'poor' | 'marginal') => string,
    ratingOverride?: Condition,
  ) => {
    const rating = ratingOverride ?? evaluateCondition(val, type, thresholds);
    const include =
      status === 'maybe'
        ? rating === 'marginal' || rating === 'fair'
        : rating === 'bad' || rating === 'poor';
    if (include) issues.push(label(issueTier(rating)));
  };

  const temp = formatTemperature(weather.temperature, tempUnit, { withUnitLabel: true });
  addIssue(weather.temperature, 'temperature', (tier) =>
    weather.temperature < 50 ? ISSUE_PHRASES.COLD(temp, tier) : ISSUE_PHRASES.HEAT(temp, tier),
  );
  const gustDriven = isGustDriven(weather.windSpeed, weather.windGust);
  addIssue(
    weather.windSpeed,
    'windSpeed',
    (tier) =>
      gustDriven
        ? ISSUE_PHRASES.GUSTS(Math.round(weather.windGust ?? weather.windSpeed), tier)
        : ISSUE_PHRASES.WIND(Math.round(weather.windSpeed), tier),
    evaluateWind(weather.windSpeed, weather.windGust, thresholds),
  );
  addIssue(weather.rainChance, 'rainChance', (tier) =>
    ISSUE_PHRASES.RAIN(formatPercent(weather.rainChance), tier),
  );
  const weatherCodeIssue = getWeatherCodeIssue(weather.weatherCode, status);
  const precipitationAlreadyExplainsWeather =
    weatherCodeIssue &&
    /(rain|drizzle|shower)/i.test(weatherCodeIssue) &&
    issues.some((issue) => /\brain\b/i.test(issue));
  if (weatherCodeIssue && !precipitationAlreadyExplainsWeather) {
    issues.push(weatherCodeIssue);
  }
  addIssue(weather.dewpoint, 'dewpoint', (tier) =>
    ISSUE_PHRASES.HUMIDITY(
      formatTemperature(weather.dewpoint, tempUnit, { withUnitLabel: true }),
      tier,
    ),
  );
  if (weather.aqi != null) {
    addIssue(weather.aqi, 'aqi', (tier) => ISSUE_PHRASES.AQI(weather.aqi ?? 0, tier));
  }
  return issues;
};

export const getMessage = (
  weather: Weather,
  status: RideStatus,
  thresholds: Thresholds = THRESHOLDS,
  tempUnit: TempUnit = 'fahrenheit',
): VerdictMessage => {
  if (weather.hasThunderstorms) return { lead: MSG.THUNDERSTORM, issues: [], timing: null };
  if (status === 'yes') {
    return {
      lead: MSG.GOOD(
        formatTemperature(weather.feelsLike, tempUnit, { withUnitLabel: true }),
        weather.condition,
      ),
      issues: [],
      timing: null,
    };
  }

  const laterGood = getLaterGoodHour(weather.hourly);
  const issues = collectMessageIssues(weather, status, thresholds, tempUnit);

  let lead: string;
  if (status === 'maybe') lead = issues.length > 0 ? MSG.MAYBE_LEAD : MSG.MAYBE_IDEAL;
  else lead = issues.length > 0 ? MSG.NO_LEAD : MSG.NO_IDEAL;

  let timing: string | null = null;
  if (laterGood) {
    timing = status === 'maybe' ? MSG.LATER_GOOD(laterGood) : MSG.CLEAR_UP(laterGood);
  }

  return { lead, issues, timing };
};

/** Returns up to 3 limiting ride factors with label, value, and condition rating. */
export const getRideFactors = (
  weather: Weather | null | undefined,
  status: RideStatus | null | undefined,
  thresholds: Thresholds = THRESHOLDS,
  tempUnit: TempUnit = 'fahrenheit',
): RideFactor[] => {
  if (!weather || !status || status === 'yes') return [];

  const isLimiting = (rating: Condition): boolean => {
    if (status === 'no') return rating === 'bad' || rating === 'poor';
    return rating === 'marginal' || rating === 'fair';
  };

  const factors: RideFactor[] = [];

  const tempRating = evaluateCondition(weather.temperature, 'temperature', thresholds);
  if (isLimiting(tempRating)) {
    factors.push({
      type: 'temperature',
      label: 'Temperature',
      value: formatTemperature(weather.temperature, tempUnit, { withUnitLabel: true }),
      condition: tempRating,
    });
  }

  const windRating = evaluateWind(weather.windSpeed, weather.windGust, thresholds);
  if (isLimiting(windRating)) {
    factors.push({
      type: 'windSpeed',
      label: 'Wind',
      value: isGustDriven(weather.windSpeed, weather.windGust)
        ? `${Math.round(weather.windGust ?? weather.windSpeed)} mph gusts`
        : `${Math.round(weather.windSpeed)} mph`,
      condition: windRating,
    });
  }

  const rainRating = evaluateCondition(weather.rainChance, 'rainChance', thresholds);
  if (isLimiting(rainRating)) {
    factors.push({
      type: 'rainChance',
      label: 'Rain',
      value: `${formatPercent(weather.rainChance)} chance`,
      condition: rainRating,
    });
  }

  const dewRating = evaluateCondition(weather.dewpoint, 'dewpoint', thresholds);
  if (isLimiting(dewRating)) {
    factors.push({
      type: 'dewpoint',
      label: 'Humidity',
      value: `Dew ${formatTemperature(weather.dewpoint, tempUnit, { withUnitLabel: true })}`,
      condition: dewRating,
    });
  }

  if (weather.aqi != null) {
    const aqiRating = evaluateCondition(weather.aqi, 'aqi', thresholds);
    if (isLimiting(aqiRating)) {
      factors.push({
        type: 'aqi',
        label: 'Air quality',
        value: `AQI ${weather.aqi}`,
        condition: aqiRating,
      });
    }
  }

  const codeRating = getWeatherCodeCondition(weather.weatherCode);
  if (isLimiting(codeRating)) {
    factors.push({
      type: 'weatherCode',
      label: 'Conditions',
      value: getWeatherDescription(weather.weatherCode),
      condition: codeRating,
    });
  }

  factors.sort((a, b) => RANK[a.condition] - RANK[b.condition]);
  return factors.slice(0, 3);
};

/** Returns a concise best-window message for the hourly forecast. */
export const getBestRideWindow = (hourly: HourlyWeather[] | undefined): string | null => {
  if (!hourly || hourly.length === 0) return null;
  if (hourly[0]?.condition === 'good') return 'Best now';
  const later = getLaterGoodHour(hourly);
  if (later) return `Improves around ${later}`;
  return 'No clear window in the next 24 hours';
};

export const getRainTiming = (hourly: HourlyWeather[] | undefined): string | null => {
  if (!hourly || hourly.length === 0) return null;
  const rainThreshold = THRESHOLDS.RAIN_CHANCE.MARGINAL;
  const firstRainIdx = hourly.findIndex((h) => h.rainChance > rainThreshold);
  if (firstRainIdx === -1) return null;

  let lastRainIdx = firstRainIdx;
  while (
    lastRainIdx + 1 < hourly.length &&
    (hourly[lastRainIdx + 1]?.rainChance ?? 0) > rainThreshold
  ) {
    lastRainIdx += 1;
  }

  const firstRain = hourly[firstRainIdx];
  const lastRain = hourly[lastRainIdx];
  if (!firstRain || !lastRain) return null;
  const isRainingNow = firstRainIdx === 0;
  const clearsUp = lastRainIdx < hourly.length - 1;

  if (isRainingNow && clearsUp) return RAIN_MESSAGES.CLEARING(fullHourLabel(lastRain.hour + 1));
  // THROUGHOUT means rain persists through the entire visible window, not necessarily the whole day.
  if (isRainingNow) return RAIN_MESSAGES.THROUGHOUT;
  if (clearsUp)
    return RAIN_MESSAGES.WINDOW(fullHourLabel(firstRain.hour), fullHourLabel(lastRain.hour + 1));
  return RAIN_MESSAGES.LATER(fullHourLabel(firstRain.hour));
};

export const getDaylightWarning = (
  hourly: HourlyWeather[] | undefined,
  daylight: DaylightWindow | null | undefined,
): string | null => {
  if (!hourly || !daylight) return null;
  const { sunriseHour, sunsetHour } = daylight;
  const goodHours = hourly.filter((h) => h.condition === 'good' || h.condition === 'fair');
  if (goodHours.length === 0) return null;
  if (goodHours.every((h) => h.hour < sunriseHour || h.hour >= sunsetHour))
    return DAYLIGHT_MESSAGES.DARK_WARNING;
  return null;
};
