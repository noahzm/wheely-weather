import { THRESHOLDS, type Thresholds } from './constants';
import {
  STATUS_MESSAGES as MSG,
  ISSUE_PHRASES,
  RAIN_MESSAGES,
  DAYLIGHT_MESSAGES,
  issuePhraseTier,
  type IssueTier,
} from './copy';
import {
  evaluateCondition,
  evaluateWind,
  evaluateColdRainHazard,
  evaluateRain,
  getLaterGoodHour,
  isRainAmountCapped,
  isColdTemp,
  isGustDriven,
  RANK,
} from './scoring';
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

/**
 * Collects the limiting-factor labels to mention in the verdict, in insertion
 * order (temp → wind → rain → weather → dewpoint → AQI). Phrasing comes from
 * the shared ISSUE_PHRASES table so the hero chips and the hourly chart drawer
 * describe the same metric with the same words.
 */
// The verdict names at most this many issues: the worst ones, which decide it.
// The rest stay in the "Right now" card and the hourly chart.
const MAX_MESSAGE_ISSUES = 3;

const collectMessageIssues = (
  weather: Weather,
  status: RideStatus,
  thresholds: Thresholds,
  tempUnit: TempUnit = 'fahrenheit',
): string[] => {
  const issues: { text: string; rating: Condition }[] = [];
  const pushIssue = (text: string, rating: Condition) => {
    issues.push({ text, rating });
  };
  const addIssue = (
    val: number | null | undefined,
    type: MetricType,
    label: (tier: IssueTier) => string,
    ratingOverride?: Condition,
  ) => {
    const rating = ratingOverride ?? evaluateCondition(val, type, thresholds);
    const include =
      status === 'maybe'
        ? rating === 'marginal' || rating === 'fair'
        : rating === 'bad' || rating === 'poor';
    const tier = issuePhraseTier(rating);
    if (include && tier) pushIssue(label(tier), rating);
  };

  const temp = formatTemperature(weather.temperature, tempUnit, { withUnitLabel: true });
  // Rain leads among equally rated issues: it's what riders plan around, and
  // the card's icon often shows it.
  const coldRainCondition = evaluateColdRainHazard(
    weather.temperature,
    weather.rainChance,
    weather.weatherCode,
    thresholds,
  );
  const coldRainTier = coldRainCondition ? issuePhraseTier(coldRainCondition) : null;
  if (coldRainCondition && coldRainTier) {
    pushIssue(
      ISSUE_PHRASES.COLD_RAIN(temp, formatPercent(weather.rainChance), coldRainTier),
      coldRainCondition,
    );
  } else {
    addIssue(
      weather.rainChance,
      'rainChance',
      (tier) => rainPhrase(weather.rainChance, weather.precipitation, tier, thresholds),
      evaluateRain(weather.rainChance, weather.precipitation, thresholds),
    );
  }
  addIssue(weather.temperature, 'temperature', (tier) =>
    isColdTemp(weather.temperature)
      ? ISSUE_PHRASES.COLD(temp, tier)
      : ISSUE_PHRASES.HEAT(temp, tier),
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
  const weatherCodeIssue = getWeatherCodeIssue(weather.weatherCode, status);
  const precipitationAlreadyExplainsWeather =
    weatherCodeIssue &&
    /(rain|drizzle|shower)/i.test(weatherCodeIssue) &&
    issues.some(({ text }) => /\brain\b/i.test(text));
  if (weatherCodeIssue && !precipitationAlreadyExplainsWeather) {
    pushIssue(weatherCodeIssue, getWeatherCodeCondition(weather.weatherCode));
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
  // Worst first, so the issue that set the rating leads: a "maybe" set by a
  // muggy dew point read "Warm…, breezy…, rain possible…, muggy…, and moderate
  // air quality…". The sort is stable, so equal ratings keep the order above:
  // rain, temperature, wind, sky, dew point, air.
  return [...issues]
    .sort((a, b) => RANK[a.rating] - RANK[b.rating])
    .slice(0, MAX_MESSAGE_ISSUES)
    .map(({ text }) => text);
};

/** Phrases a rain issue, naming light rain when the amount capped the rating. */
export const rainPhrase = (
  chance: number,
  amountMm: number | null | undefined,
  tier: IssueTier,
  thresholds: Thresholds = THRESHOLDS,
): string =>
  isRainAmountCapped(chance, amountMm, thresholds)
    ? ISSUE_PHRASES.LIGHT_RAIN(formatPercent(chance), tier)
    : ISSUE_PHRASES.RAIN(formatPercent(chance), tier);

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
        formatTemperature(weather.temperature, tempUnit, { withUnitLabel: true }),
        weather.condition,
        evaluateWind(weather.windSpeed, weather.windGust, thresholds),
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

/**
 * The main thing wrong with the current conditions, for the verdict's wait
 * state ("Right now: rain expected (90%)"). Falls back to the sky description.
 */
export const describeNow = (
  weather: Weather,
  thresholds: Thresholds = THRESHOLDS,
  tempUnit: TempUnit = 'fahrenheit',
): string => {
  if (weather.hasThunderstorms) return 'Thunderstorms';
  const [worst] = collectMessageIssues(weather, 'no', thresholds, tempUnit);
  return worst ?? weather.condition;
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

  const rainRating = evaluateRain(weather.rainChance, weather.precipitation, thresholds);
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
  // The hours run 24 ahead, so a bare "10 AM" seen at 3 PM reads as already past.
  // Times on the next day say so; midnight still reads as tonight.
  const clearsTomorrow = isNextDay(hourly, lastRainIdx);
  const startsTomorrow = firstRain.hour !== 0 && isNextDay(hourly, firstRainIdx);
  const start = fullHourLabel(firstRain.hour);
  const end = fullHourLabel(lastRain.hour + 1);

  if (isRainingNow && clearsUp) {
    return clearsTomorrow ? RAIN_MESSAGES.CLEARING_TOMORROW(end) : RAIN_MESSAGES.CLEARING(end);
  }
  // THROUGHOUT means rain persists through the entire visible window, not necessarily the whole day.
  if (isRainingNow) return RAIN_MESSAGES.THROUGHOUT;
  if (clearsUp) {
    return startsTomorrow
      ? RAIN_MESSAGES.WINDOW_TOMORROW(start, end)
      : RAIN_MESSAGES.WINDOW(start, end);
  }
  return startsTomorrow ? RAIN_MESSAGES.LATER_TOMORROW(start) : RAIN_MESSAGES.LATER(start);
};

/** Whether the hour at `index` falls after midnight, counting from the first hour. */
function isNextDay(hourly: HourlyWeather[], index: number): boolean {
  for (let i = 1; i <= index; i++) {
    const previous = hourly[i - 1];
    const current = hourly[i];
    if (previous && current && current.hour < previous.hour) return true;
  }
  return false;
}

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
