import { THRESHOLDS, type Thresholds } from './constants';
import { STATUS_MESSAGES as MSG } from './copy';
import { getMessage } from './ride-factors';
import { calculateRideScore, evaluateCondition, getOverallStatus, RANK } from './scoring';
import { getWeatherDescription, isThunderstorm } from './weather-codes';

import { fullHourLabel } from '../utils/timeFormat';
import type { TempUnit } from '../utils/temperature';

import type { DailyWeather, RideStatus, VerdictMessage, Weather } from '@/types/weather';

/**
 * Which stretch of time the verdict rates:
 * - `now`: today's best window starts this hour
 * - `later`: today's best window is later today
 * - `tomorrow`: no daylight left today, so tomorrow's best window
 * - `current`: no window at all (missing data), so the current conditions
 */
export type VerdictWhen = 'now' | 'later' | 'tomorrow' | 'current';

export interface RideVerdict {
  status: RideStatus;
  /** 0–10 ride score for the rated stretch. */
  score: number;
  message: VerdictMessage;
  when: VerdictWhen;
  /** The rated window's hours ([start, end), local), or null for `current`. */
  window: { startHour: number; endHour: number } | null;
  /** The conditions the verdict was worked out from, for callers that describe them. */
  rated: Weather;
}

type DayWithWindow = DailyWeather & { rideWindow: NonNullable<DailyWeather['rideWindow']> };

const hasWindow = (day: DailyWeather | undefined): day is DayWithWindow => day?.rideWindow != null;

/**
 * The window's worst-case conditions as a `Weather`, so the existing rating,
 * scoring and copy apply unchanged. Temperature takes whichever end of the
 * window rates worse (the warm end on a tie, which reads naturally in "68°F,
 * sunny"). Today's AQI carries over; tomorrow has no reading.
 */
function windowWeather(
  weather: Weather,
  day: DayWithWindow,
  isToday: boolean,
  thresholds: Thresholds,
): Weather {
  const { tempLow, tempHigh } = day.rideWindow;
  const lowRank = RANK[evaluateCondition(tempLow, 'temperature', thresholds)];
  const highRank = RANK[evaluateCondition(tempHigh, 'temperature', thresholds)];
  const temperature = lowRank < highRank ? tempLow : tempHigh;
  return {
    ...weather,
    temperature,
    feelsLike: temperature,
    windSpeed: day.windSpeed,
    windGust: day.windGust,
    rainChance: day.rainChance,
    precipitation: day.precipitation ?? null,
    dewpoint: day.dewpoint ?? weather.dewpoint,
    weatherCode: day.weatherCode,
    hasThunderstorms: isThunderstorm(day.weatherCode),
    condition: day.weatherCode == null ? weather.condition : getWeatherDescription(day.weatherCode),
    aqi: isToday ? weather.aqi : null,
  };
}

const windowRange = ({ startHour, endHour }: { startHour: number; endHour: number }): string =>
  `${fullHourLabel(startHour)}–${fullHourLabel(endHour)}`;

/** Timing chip for the rated window; none when the best window is already underway. */
function windowTiming(
  when: VerdictWhen,
  status: RideStatus,
  window: { startHour: number; endHour: number },
): string | null {
  if (when === 'tomorrow') return MSG.TOMORROW_WINDOW(windowRange(window));
  // A later window only helps if it's worth riding in; on a "no" day the
  // best of a bad day isn't a recommendation.
  if (when === 'later' && status !== 'no') return MSG.BEST_WINDOW(windowRange(window));
  return null;
}

/**
 * The home screen and widget verdict. Rates the day's best ride window rather
 * than the current hour: a wet 7 AM no longer brands a dry afternoon a
 * "Wrench day", and a calm 10 PM no longer says "Let's ride" in the dark. With
 * no daylight left today it rates tomorrow's best window instead.
 */
export function getRideVerdict(
  weather: Weather,
  thresholds: Thresholds = THRESHOLDS,
  tempUnit: TempUnit = 'fahrenheit',
): RideVerdict {
  const [today, tomorrow] = weather.daily;
  let target: DayWithWindow | null = null;
  if (hasWindow(today)) target = today;
  else if (hasWindow(tomorrow)) target = tomorrow;

  if (!target) {
    const status = getOverallStatus(weather, thresholds);
    return {
      status,
      score: calculateRideScore(weather, thresholds),
      message: getMessage(weather, status, thresholds, tempUnit),
      when: 'current',
      window: null,
      rated: weather,
    };
  }

  const isToday = target === today;
  const window = {
    startHour: target.rideWindow.startHour,
    endHour: target.rideWindow.endHour,
  };
  let when: VerdictWhen = 'tomorrow';
  if (isToday) when = window.startHour === weather.hourly[0]?.hour ? 'now' : 'later';

  const rated = windowWeather(weather, target, isToday, thresholds);
  const status = getOverallStatus(rated, thresholds);
  const message = getMessage(rated, status, thresholds, tempUnit);
  return {
    status,
    score: calculateRideScore(rated, thresholds),
    // The window replaces "improves around…" timing, which described the
    // current hour's trajectory rather than the stretch being rated.
    message: { ...message, timing: windowTiming(when, status, window) },
    when,
    window,
    rated,
  };
}
