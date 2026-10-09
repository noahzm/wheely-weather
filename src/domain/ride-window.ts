// Picks each day's best ride: the contiguous daylight window that rates and
// scores best. Metrics within a candidate stay worst-case so its rating remains
// honest, but a brief rough hour no longer condemns an otherwise rideable day.
import type { Thresholds } from './constants';
import { RANK, getDailyCondition } from './scoring';
import { getWeatherCodeCondition } from './weather-codes';

import type { DailyWeather } from '@/types/weather';

/** One daylight hour's forecast, as the window search reads it. */
export interface RideWindowHour {
  hour: number;
  temperature: number;
  windSpeed: number;
  windGust: number | null;
  rainChance: number;
  precipitation: number | null;
  dewpoint: number | null;
  weatherCode: number | null;
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
  condition: DailyWeather['condition'];
}

export const DAILY_RIDE_WINDOW_HOURS = 3;
// Late in the day, today's window may shrink to what daylight is left, down to
// this many hours. Without it a winter afternoon (sunset ~5 PM) had no window
// from 2 PM on, and the verdict jumped to tomorrow hours too early.
export const MIN_TODAY_WINDOW_HOURS = 2;

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
      },
      thresholds,
    ),
  };
}

/**
 * The best-scoring window of up to three hours within one day's daylight
 * hours, or null when fewer than `minHours` remain.
 */
export function selectBestRideWindow(
  hours: RideWindowHour[],
  thresholds: Thresholds,
  minHours: number = DAILY_RIDE_WINDOW_HOURS,
): DailyRideWindow | null {
  if (hours.length < minHours) return null;
  const windowHours = Math.min(DAILY_RIDE_WINDOW_HOURS, hours.length);

  let best: DailyRideWindow | null = null;
  let bestScore = -Infinity;
  for (let start = 0; start <= hours.length - windowHours; start++) {
    const candidate = buildRideWindowCandidate(hours.slice(start, start + windowHours), thresholds);
    if (!candidate) continue;
    const score = scoreRideWindow(candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Each date's best window, from its remaining daylight hours. Today may settle
 * for a shorter window than later days (`MIN_TODAY_WINDOW_HOURS`).
 */
export function selectBestRideWindows(
  hoursByDate: Record<string, RideWindowHour[]>,
  today: string,
  thresholds: Thresholds,
): Record<string, DailyRideWindow> {
  const bestByDate: Record<string, DailyRideWindow> = {};
  for (const [date, hours] of Object.entries(hoursByDate)) {
    const minHours = date === today ? MIN_TODAY_WINDOW_HOURS : DAILY_RIDE_WINDOW_HOURS;
    const best = selectBestRideWindow(hours, thresholds, minHours);
    if (best) bestByDate[date] = best;
  }
  return bestByDate;
}
