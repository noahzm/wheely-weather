import { THRESHOLDS, type Thresholds } from './constants';
import { evaluateCondition, RANK } from './scoring';

import type { Condition, HourlyWeather, Weather } from '@/types/weather';

const worse = (a: Condition, b: Condition): Condition => (RANK[a] <= RANK[b] ? a : b);

/** Number of leading hours that are still today (the list is contiguous, so the hour wraps at midnight). */
function countTodayHours(hourly: HourlyWeather[]): number {
  let count = 0;
  let previous = -1;
  for (const hour of hourly) {
    if (hour.hour < previous) break;
    previous = hour.hour;
    count++;
  }
  return count;
}

/**
 * Folds the current air-quality reading into the rest of today's hourly
 * ratings and today's day rating, so the chart agrees with a verdict that AQI
 * pulled down (smoke used to leave green hours under "Hard pass"). Only a
 * current reading is fetched, so it stands in for the rest of today and says
 * nothing about tomorrow. Each touched hour keeps the AQI so its reason can
 * name it. Returns the weather unchanged when there is no reading.
 */
export function applyAirQualityToToday(
  weather: Weather,
  thresholds: Thresholds = THRESHOLDS,
): Weather {
  if (weather.aqi == null) return weather;
  const aqi = weather.aqi;
  const rating = evaluateCondition(aqi, 'aqi', thresholds);
  const todayHours = countTodayHours(weather.hourly);
  const hourly = weather.hourly.map((hour, index) =>
    index < todayHours ? { ...hour, aqi, condition: worse(hour.condition, rating) } : hour,
  );
  const [today, ...laterDays] = weather.daily;
  const daily = today
    ? [{ ...today, condition: worse(today.condition, rating) }, ...laterDays]
    : [];
  return { ...weather, hourly, daily };
}
