import { THRESHOLDS, type Thresholds } from './constants';
import { getVerdictLabel, STATUS_MESSAGES as MSG } from './copy';
import { describeNow, getMessage } from './ride-factors';
import {
  calculateRideScore,
  conditionToStatus,
  evaluateCondition,
  getCurrentCondition,
  getOverallCondition,
  RANK,
} from './scoring';
import { getWeatherDescription, isThunderstorm } from './weather-codes';

import { fullHourLabel } from '../utils/timeFormat';
import type { TempUnit } from '../utils/temperature';

import type { Condition, DailyWeather, RideStatus, VerdictMessage, Weather } from '@/types/weather';

/**
 * Which stretch of time the verdict rates:
 * - `now`: today's best window starts this hour
 * - `wait`: today's best window is later, and right now is a no-go
 * - `later`: today's best window is later, and right now is rideable too
 * - `tomorrow`: no daylight left today, so tomorrow's best window
 * - `current`: no window at all (missing data), so the current conditions
 */
export type VerdictWhen = 'now' | 'wait' | 'later' | 'tomorrow' | 'current';

export interface RideVerdict {
  status: RideStatus;
  /** The five-level rating behind `status`, for colors that match the week list and chart. */
  condition: Condition;
  /** 0–10 ride score for the rated stretch. */
  score: number;
  message: VerdictMessage;
  when: VerdictWhen;
  /** The rated window's hours ([start, end), local), or null for `current`. */
  window: { startHour: number; endHour: number } | null;
  /** The conditions the verdict was worked out from, for callers that describe them. */
  rated: Weather;
  /**
   * The weather code to illustrate the verdict with: the window's, except while
   * waiting, when it's the current sky so the icon matches the view outside.
   */
  weatherCode: number | null;
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
  // Waiting, the headline already names the start ("Ride at 2 PM").
  if (when === 'wait') return MSG.UNTIL(fullHourLabel(window.endHour));
  // On a "no" day the later window isn't a recommendation, but riders who have
  // to go (and riders in climates with long no-go seasons) still need to know
  // when it's least rough, so it's named without calling it good.
  if (when === 'later') {
    const range = windowRange(window);
    return status === 'no' ? MSG.LEAST_BAD_WINDOW(range) : MSG.BEST_WINDOW(range);
  }
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
    const condition = getCurrentCondition(weather, thresholds);
    const status = conditionToStatus(condition);
    return {
      status,
      condition,
      score: calculateRideScore(weather, thresholds, status),
      message: getMessage(weather, status, thresholds, tempUnit),
      when: 'current',
      window: null,
      rated: weather,
      weatherCode: weather.weatherCode,
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
  const condition = getOverallCondition(rated, thresholds);
  const status = conditionToStatus(condition);
  // A good later window while it's pouring now reads as "go ride" to anyone
  // looking out the window, so the verdict says to wait and names why.
  const nowStatus = conditionToStatus(getCurrentCondition(weather, thresholds));
  if (when === 'later' && status !== 'no' && nowStatus === 'no') {
    when = 'wait';
  }
  const message = getMessage(rated, status, thresholds, tempUnit);
  return {
    status,
    condition,
    score: calculateRideScore(rated, thresholds),
    // The window replaces "improves around…" timing, which described the
    // current hour's trajectory rather than the stretch being rated.
    message: {
      ...message,
      timing: windowTiming(when, status, window),
      now: when === 'wait' ? describeNow(weather, thresholds, tempUnit) : null,
    },
    when,
    window,
    rated,
    weatherCode: when === 'wait' ? weather.weatherCode : rated.weatherCode,
  };
}

/** The verdict's headline; in the wait state it names when to head out ("Wait till 2 PM"). */
export function getRideVerdictLabel(verdict: RideVerdict, location = ''): string {
  const waitFrom =
    verdict.when === 'wait' && verdict.window ? fullHourLabel(verdict.window.startHour) : null;
  return getVerdictLabel(verdict.status, location, waitFrom);
}

/**
 * The kit section's heading. The kit dresses for the rated window, so it says
 * when that is; on a no-go day it's advice for riding anyway, not a nudge to go.
 */
export function getRideKitTitle(verdict: Pick<RideVerdict, 'status' | 'when'>): string {
  if (verdict.status === 'no') return MSG.KIT_ANYWAY;
  if (verdict.when === 'tomorrow') return MSG.KIT_TOMORROW;
  return MSG.KIT_TODAY;
}
