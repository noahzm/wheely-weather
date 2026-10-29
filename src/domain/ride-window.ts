// Picks each day's best ride: the contiguous daylight window that rates and
// scores best. Metrics within a candidate stay worst-case so its rating remains
// honest, but a brief rough hour no longer condemns an otherwise rideable day.
import type { Thresholds } from './constants';
import { heatIndex } from './heat-index';
import { RANK, getDailyCondition } from './scoring';
import { getWeatherCodeCondition } from './weather-codes';

import type { DailyWeather } from '@/types/weather';

/** One rideable hour's forecast (daylight, or any hour with night riding), as the window search reads it. */
export interface RideWindowHour {
  hour: number;
  temperature: number;
  windSpeed: number;
  windGust: number | null;
  rainChance: number;
  precipitation: number | null;
  dewpoint: number | null;
  weatherCode: number | null;
  /** UV index; unrated (it sets the kit's sunscreen, not the ride). */
  uv?: number | null;
  /**
   * Hours from daylight with night riding on: 0 (or absent) in daylight, 1 for
   * the first hour after sunset or before sunrise, rising toward midnight.
   */
  darkness?: number;
}

/** A rated window: worst-case metrics over hours `startHour`–`endHour` (exclusive). */
export interface DailyRideWindow {
  startHour: number;
  endHour: number;
  tempLow: number;
  tempHigh: number;
  windSpeed: number;
  windGust: number | null;
  rainChance: number;
  precipitation: number | null;
  dewpoint: number | null;
  weatherCode: number | null;
  /** Highest UV index in the window, or null when no hour has one. */
  uvMax: number | null;
  /** Highest hourly heat index (°F), or null when no hour has a dew point. */
  heatIndexMax: number | null;
  condition: DailyWeather['condition'];
}

const DAILY_RIDE_WINDOW_HOURS = 3;
// Late in the day, today's window may shrink to what daylight is left, down to
// this many hours. Without it a winter afternoon (sunset ~5 PM) had no window
// from 2 PM on, and the verdict jumped to tomorrow hours too early.
const MIN_TODAY_WINDOW_HOURS = 2;

/**
 * The ride length of the All day setting. No day has this much daylight, so
 * each day's window is all of its daylight hours, however short the day.
 */
export const ALL_DAY_RIDE_HOURS = 24;

function getWorstWeatherCode(codes: (number | null)[]): number | null {
  let worstCode: number | null = null;
  let worstRank = Infinity;
  for (const code of codes) {
    if (code == null) continue;
    const rank = RANK[getWeatherCodeCondition(code)];
    if (rank < worstRank) {
      worstCode = code;
      worstRank = rank;
    }
  }
  return worstCode;
}

/**
 * Score lost per hour of darkness, times how deep into the night that hour is.
 * Big enough to outweigh the calm, cool hours of the small hours, small next to
 * a rating step (1000), so a night rider still escapes a hot, stormy or windy
 * day, but into the evening or the hour before sunrise, not the middle of the
 * night.
 */
const DARK_HOUR_PENALTY = 15;

/**
 * How many hours `hour` sits outside daylight (`[sunriseHour, sunsetHour)`):
 * 0 in daylight, 1 for the hour after sunset or before sunrise, and so on to
 * the middle of the night, measured to the nearer of dusk and dawn.
 */
export function hoursFromDaylight(
  hour: number,
  { sunriseHour, sunsetHour }: { sunriseHour: number; sunsetHour: number },
): number {
  if (hour >= sunriseHour && hour < sunsetHour) return 0;
  const afterDusk = (hour - sunsetHour + 24) % 24;
  const beforeDawn = (sunriseHour - hour + 24) % 24;
  return Math.min(afterDusk + 1, beforeDawn);
}

function darknessPenalty(hours: RideWindowHour[]): number {
  return hours.reduce((sum, hour) => sum + (hour.darkness ?? 0), 0) * DARK_HOUR_PENALTY;
}

/** Ranks windows that share a rating: drier, calmer and nearer 68°F wins. */
export function scoreRideWindow(window: DailyRideWindow): number {
  const avgTemp = (window.tempLow + window.tempHigh) / 2;
  const gust = window.windGust ?? window.windSpeed;
  return (
    RANK[window.condition] * 1000 -
    window.rainChance * 2 -
    window.windSpeed * 3 -
    gust +
    Math.max(0, 20 - Math.abs(avgTemp - 68))
  );
}

/** Rates consecutive hours as one window; null when empty or not contiguous. */
export function buildRideWindowCandidate(
  hours: RideWindowHour[],
  thresholds: Thresholds,
): DailyRideWindow | null {
  const first = hours[0];
  const last = hours.at(-1);
  if (!first || !last) return null;
  if (last.hour - first.hour !== hours.length - 1) return null;

  const temperatures = hours.map((hour) => hour.temperature);
  const windSpeed = Math.max(...hours.map((hour) => hour.windSpeed));
  const gusts = hours.map((hour) => hour.windGust).filter((gust): gust is number => gust != null);
  const windGust = gusts.length > 0 ? Math.max(...gusts) : null;
  const rainChance = Math.max(...hours.map((hour) => hour.rainChance));
  // Worst hour's amount, matching the worst-case chance above; unknown if any
  // hour lacks it, so a partial series can't understate the rain.
  const amounts = hours.map((hour) => hour.precipitation);
  const precipitation = amounts.every((amount): amount is number => amount != null)
    ? Math.max(...amounts)
    : null;
  const dewpoints = hours
    .map((hour) => hour.dewpoint)
    .filter((dewpoint): dewpoint is number => dewpoint != null);
  const dewpoint = dewpoints.length > 0 ? Math.max(...dewpoints) : null;
  const weatherCode = getWorstWeatherCode(hours.map((hour) => hour.weatherCode));
  const uvs = hours.map((hour) => hour.uv).filter((uv): uv is number => uv != null);
  const uvMax = uvs.length > 0 ? Math.max(...uvs) : null;
  // Per hour, then the peak: the hottest hour and the muggiest needn't be the
  // same one, and pairing them overstates the heat index.
  const heatIndexes = hours
    .map((hour) => heatIndex(hour.temperature, hour.dewpoint))
    .filter((index): index is number => index != null);
  const heatIndexMax = heatIndexes.length > 0 ? Math.max(...heatIndexes) : null;
  const tempLow = Math.min(...temperatures);
  const tempHigh = Math.max(...temperatures);

  return {
    startHour: first.hour,
    endHour: last.hour + 1,
    tempLow,
    tempHigh,
    windSpeed,
    windGust,
    rainChance,
    precipitation,
    dewpoint,
    weatherCode,
    uvMax,
    heatIndexMax,
    condition: getDailyCondition(
      {
        tempLow,
        tempHigh,
        wind: windSpeed,
        gust: windGust,
        rain: rainChance,
        precip: precipitation,
        code: weatherCode,
        dewpoint,
        heatIndex: heatIndexMax,
      },
      thresholds,
    ),
  };
}

/**
 * The best-scoring window of up to `targetHours` hours within one day's daylight
 * hours, or null when fewer than `minHours` remain.
 */
export function selectBestRideWindow(
  hours: RideWindowHour[],
  thresholds: Thresholds,
  minHours: number = DAILY_RIDE_WINDOW_HOURS,
  targetHours: number = DAILY_RIDE_WINDOW_HOURS,
): DailyRideWindow | null {
  const effectiveMin = Math.min(minHours, targetHours);
  if (hours.length < effectiveMin) return null;
  const windowHours = Math.min(targetHours, hours.length);

  let best: DailyRideWindow | null = null;
  let bestScore = -Infinity;
  for (let start = 0; start <= hours.length - windowHours; start++) {
    const slice = hours.slice(start, start + windowHours);
    const candidate = buildRideWindowCandidate(slice, thresholds);
    if (!candidate) continue;
    // Night riding: dark hours count against a window, the deeper the more.
    const score = scoreRideWindow(candidate) - darknessPenalty(slice);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

/**
 * How many hours a later day's window needs: the whole ride, or for an all-day
 * ride, whatever daylight the day has.
 */
function minHoursForLaterDay(hours: RideWindowHour[], targetHours: number): number {
  return targetHours >= ALL_DAY_RIDE_HOURS ? hours.length : targetHours;
}

/**
 * Each date's best window, from its remaining rideable hours. Today may settle
 * for a shorter window than later days (`MIN_TODAY_WINDOW_HOURS` in daylight,
 * or 1 hour when night riding is on so 11 PM still rates tonight).
 */
export function selectBestRideWindows(
  hoursByDate: Record<string, RideWindowHour[]>,
  today: string,
  thresholds: Thresholds,
  targetHours: number = DAILY_RIDE_WINDOW_HOURS,
  nightRiding = false,
): Record<string, DailyRideWindow> {
  const bestByDate: Record<string, DailyRideWindow> = {};
  const todayMin = nightRiding ? 1 : Math.min(MIN_TODAY_WINDOW_HOURS, targetHours);
  for (const [date, hours] of Object.entries(hoursByDate)) {
    const minHours = date === today ? todayMin : minHoursForLaterDay(hours, targetHours);
    const best = selectBestRideWindow(hours, thresholds, minHours, targetHours);
    if (best) bestByDate[date] = best;
  }
  return bestByDate;
}
