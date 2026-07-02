import { THRESHOLDS, type Thresholds } from './constants';
import { STATUS_MESSAGES as MSG, RAIN_MESSAGES, DAYLIGHT_MESSAGES } from './copy';
import {
  evaluateCondition,
  evaluateWind,
  formatHour,
  getLaterGoodHour,
  isGustDriven,
  RANK,
} from './scoring';
import {
  getWeatherCodeCondition,
  getWeatherCodeIssue,
  getWeatherDescription,
} from './weather-codes';
import { formatTemperature, type TempUnit } from '../utils/temperature';

import type {
  Condition,
  DaylightWindow,
  HourlyWeather,
  MetricType,
  RideFactor,
  RideStatus,
  Weather,
} from '@/types/weather';

const buildWindLabel = (weather: Weather, status: RideStatus, gustDriven: boolean): string => {
  if (gustDriven) {
    const gusts = Math.round(weather.windGust ?? weather.windSpeed);
    return `${status === 'no' ? 'strong gusts' : 'gusty'} (${gusts} mph gusts)`;
  }
  return `${status === 'no' ? 'heavy wind' : 'gusty'} (${Math.round(weather.windSpeed)} mph)`;
};

// Keep the verdict hero punchy: list issues inline up to MAX_INLINE, but once a
// day stacks up more than that, lead with the two most ride-relevant factors
// (insertion order is temp → wind → rain → weather → dewpoint → AQI) and roll the
// rest into a "plus N more" tail. "The numbers" section carries the full detail.
const MAX_INLINE_ISSUES = 3;

const selectBaseMessage = (status: RideStatus, issues: string[]): string => {
  const extra = issues.length > MAX_INLINE_ISSUES ? issues.length - 2 : 0;
  const shown = extra > 0 ? issues.slice(0, 2) : issues;
  if (status === 'maybe') {
    return issues.length > 0 ? MSG.MAYBE_ISSUES(shown, extra) : MSG.MAYBE_IDEAL;
  }
  return issues.length > 0 ? MSG.NO_ISSUES(shown, extra) : MSG.NO_IDEAL;
};

/**
 * Collects the limiting-factor labels to mention in the verdict, in insertion
 * order (temp → wind → rain → weather → dewpoint → AQI → UV).
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
    label: string,
    ratingOverride?: Condition,
  ) => {
    const rating = ratingOverride ?? evaluateCondition(val, type, thresholds);
    if (status === 'maybe' && (rating === 'marginal' || rating === 'fair')) issues.push(label);
    if (status === 'no' && (rating === 'bad' || rating === 'poor')) issues.push(label);
  };

  const temp = formatTemperature(weather.temperature, tempUnit, { withUnitLabel: true });
  addIssue(
    weather.temperature,
    'temperature',
    weather.temperature < 50 ? `cold (${temp})` : `hot (${temp})`,
  );
  if (status === 'no' && issues.length > 0) {
    issues[0] = weather.temperature < 36 ? `too cold (${temp})` : `too hot (${temp})`;
  }
  const gustDriven = isGustDriven(weather.windSpeed, weather.windGust);
  const windLabel = buildWindLabel(weather, status, gustDriven);
  addIssue(
    weather.windSpeed,
    'windSpeed',
    windLabel,
    evaluateWind(weather.windSpeed, weather.windGust, thresholds),
  );
  addIssue(
    weather.rainChance,
    'rainChance',
    `${status === 'no' ? 'rain' : 'rainy'} (${weather.rainChance}% chance)`,
  );
  const weatherCodeIssue = getWeatherCodeIssue(weather.weatherCode, status);
  const precipitationAlreadyExplainsWeather =
    weatherCodeIssue &&
    /(rain|drizzle|shower)/i.test(weatherCodeIssue) &&
    issues.some((issue) => /\brain\b/i.test(issue));
  if (weatherCodeIssue && !precipitationAlreadyExplainsWeather) {
    issues.push(weatherCodeIssue);
  }
  addIssue(
    weather.dewpoint,
    'dewpoint',
    `${status === 'no' ? 'heavy humidity' : 'sticky'} (dew ${formatTemperature(weather.dewpoint, tempUnit, { withUnitLabel: true })})`,
  );
  if (weather.aqi != null) {
    addIssue(
      weather.aqi,
      'aqi',
      `${status === 'no' ? 'poor air quality' : 'hazy'} (AQI ${weather.aqi})`,
    );
  }
  return issues;
};

export const getMessage = (
  weather: Weather,
  status: RideStatus,
  thresholds: Thresholds = THRESHOLDS,
  tempUnit: TempUnit = 'fahrenheit',
): string => {
  if (weather.hasThunderstorms) return MSG.THUNDERSTORM;
  if (status === 'yes') {
    return MSG.GOOD(
      formatTemperature(weather.feelsLike, tempUnit, { withUnitLabel: true }),
      weather.condition,
    );
  }

  const laterGood = getLaterGoodHour(weather.hourly);
  const issues = collectMessageIssues(weather, status, thresholds, tempUnit);

  let msg = selectBaseMessage(status, issues);

  if (laterGood) msg += status === 'maybe' ? MSG.LATER_GOOD(laterGood) : MSG.CLEAR_UP(laterGood);
  else if (status === 'no') msg += MSG.REST_DAY();

  return msg;
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
      value: `${weather.rainChance}% chance`,
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

  if (isRainingNow && clearsUp) return RAIN_MESSAGES.CLEARING(formatHour(lastRain.hour + 1));
  // THROUGHOUT means rain persists through the entire visible window, not necessarily the whole day.
  if (isRainingNow) return RAIN_MESSAGES.THROUGHOUT;
  if (clearsUp)
    return RAIN_MESSAGES.WINDOW(formatHour(firstRain.hour), formatHour(lastRain.hour + 1));
  return RAIN_MESSAGES.LATER(formatHour(firstRain.hour));
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
