import { THRESHOLDS, type Thresholds } from '../domain/constants';
import { ISSUE_PHRASES } from '../domain/copy';
import { formatPercent } from './percent';
import { formatTemperature } from './temperature';

import type { Condition, DailyWeather, HourlyWeather } from '@/types/weather';
import type { TempUnit } from './temperature';

const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STORM_CODES = new Set([95, 96, 99]);
const HEAVY_RAIN_CODES = new Set([65, 82]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);

/** Returns "Today" for index 0, otherwise a short label like "Mon 24". */
export function dayLabel(date: Date | string, index: number): string {
  if (index === 0) return 'Today';
  const d = new Date(date);
  const weekday = DAY_NAMES_SHORT[d.getDay()];
  const num = d.getDate();
  return `${weekday} ${num}`;
}

const CONDITION_SCORE: Record<Condition, number> = {
  good: 300,
  fair: 200,
  marginal: 100,
  poor: 0,
  bad: -100,
};

// Prefer overall ride quality first, then reward calmer, drier, more comfortable days.
function scoreDay(day: DailyWeather): number {
  if (day.rideWindowUnavailable) return -Infinity;
  const conditionScore = CONDITION_SCORE[day.condition];

  const rainBonus = Math.max(0, 30 - day.rainChance) * 1.5;
  const effectiveWind = Math.max(day.windSpeed, day.windGust ?? day.windSpeed);
  const windBonus = Math.max(0, 24 - effectiveWind) * 1.5;
  const avgTemp = day.rideWindow
    ? (day.rideWindow.tempHigh + day.rideWindow.tempLow) / 2
    : (day.high + day.low) / 2;
  const comfortBonus = Math.max(0, 18 - Math.abs(avgTemp - 68));

  return conditionScore + rainBonus + windBonus + comfortBonus;
}

function bestDayRationale(day: DailyWeather): string {
  if (day.condition === 'fair') return getDayConditionReason(day);

  const rain = day.rainChance;
  const wind = day.windSpeed;
  const gust = day.windGust ?? wind;
  const high = day.rideWindow?.tempHigh ?? day.high;
  if (rain <= 10 && wind <= 8 && gust <= 15) return 'Low wind and dry roads';
  if (gust > 15) return 'Mostly calm with manageable gusts';
  if (high < 50 && rain <= 20) return 'Cool and clear';
  if (high > 80 && rain <= 20) return 'Warm and dry';
  if (wind <= 10) return 'Calm and steady';
  if (rain <= 20) return 'Comfortable and dry';
  return 'Solid riding weather';
}

/** Finds the index and rationale of the single best day for cycling in the 8-day forecast. */
export function getBestDayInfo(daily: DailyWeather[] | null | undefined): {
  index: number;
  rationale: string;
} {
  if (!daily || daily.length === 0) return { index: -1, rationale: '' };

  let bestIdx = -1;
  let bestScore = -Infinity;

  for (const [i, day] of daily.entries()) {
    const s = scoreDay(day);
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  }

  if (bestIdx === -1) return { index: -1, rationale: '' };

  const bestDay = daily[bestIdx];
  if (!bestDay || !['good', 'fair'].includes(bestDay.condition)) {
    return { index: -1, rationale: '' };
  }

  return { index: bestIdx, rationale: bestDayRationale(bestDay) };
}

interface DayMetrics {
  wind: number;
  rain: number;
  high: number | null;
  low: number | null;
  temp: number | null;
  dewpoint: number | null;
}

function dayMetrics(day: DailyWeather): DayMetrics {
  const high = day.rideWindow?.tempHigh ?? day.high;
  const low = day.rideWindow?.tempLow ?? day.low;
  return {
    wind: Math.round(day.windSpeed),
    rain: day.rainChance,
    high,
    low,
    // Daily reasons describe the selected ride window rather than overnight or
    // brief outlier conditions elsewhere in the day.
    temp: high,
    dewpoint: day.dewpoint ?? null,
  };
}

function weatherCodeReason(entry: { weatherCode: number | null }): string | null {
  if (entry.weatherCode == null) return null;
  if (STORM_CODES.has(entry.weatherCode)) return 'Storm risk';
  if (SNOW_CODES.has(entry.weatherCode)) return 'Wintry roads';
  if (HEAVY_RAIN_CODES.has(entry.weatherCode)) return 'Heavy rain risk';
  return null;
}

function badConditionReasons(
  { wind, rain, low, temp, dewpoint }: DayMetrics,
  tempUnit: TempUnit = 'fahrenheit',
): string[] {
  const reasons: string[] = [];
  if (wind >= 20) reasons.push(`Very windy (${wind} mph)`);
  if (rain >= 60) reasons.push(`Rain likely (${formatPercent(rain)})`);
  if (temp != null && temp > THRESHOLDS.TEMPERATURE.BAD_MAX) {
    reasons.push(`Dangerous heat (${formatTemperature(temp, tempUnit)})`);
  }
  if (dewpoint != null && dewpoint > THRESHOLDS.DEWPOINT.BAD) {
    reasons.push(`Oppressive humidity (dew ${formatTemperature(dewpoint, tempUnit)})`);
  }
  if (low != null && low < 32) reasons.push('Freezing temps');
  return reasons;
}

function poorConditionReasons(
  { wind, rain, low, temp, dewpoint }: DayMetrics,
  tempUnit: TempUnit = 'fahrenheit',
): string[] {
  const reasons: string[] = [];
  if (wind >= 18) reasons.push(`Windy (${wind} mph)`);
  if (rain >= 45) reasons.push('Wet roads likely');
  if (temp != null && temp > THRESHOLDS.TEMPERATURE.POOR_MAX) {
    reasons.push(`Very hot (${formatTemperature(temp, tempUnit)})`);
  }
  if (dewpoint != null && dewpoint > THRESHOLDS.DEWPOINT.POOR) {
    reasons.push(`Very humid (dew ${formatTemperature(dewpoint, tempUnit)})`);
  }
  if (low != null && low < 36) reasons.push('Cold start');
  return reasons;
}

function marginalConditionReasons(
  { wind, rain, low, temp, dewpoint }: DayMetrics,
  tempUnit: TempUnit = 'fahrenheit',
): string[] {
  const reasons: string[] = [];
  if (wind >= 15) reasons.push(`Breezy (${wind} mph)`);
  if (rain >= 30) reasons.push('Some rain risk');
  if (temp != null && temp > THRESHOLDS.TEMPERATURE.MARGINAL_MAX) {
    reasons.push(`Warm (${formatTemperature(temp, tempUnit)})`);
  }
  if (dewpoint != null && dewpoint > THRESHOLDS.DEWPOINT.MARGINAL) {
    reasons.push(`Muggy (dew ${formatTemperature(dewpoint, tempUnit)})`);
  }
  if (low != null && low < 45) reasons.push('Cool start');
  return reasons;
}

function badDayReason(
  { wind, rain, high, low, temp, dewpoint }: DayMetrics,
  tempUnit: TempUnit = 'fahrenheit',
): string {
  return (
    badConditionReasons({ wind, rain, high, low, temp, dewpoint }, tempUnit)[0] ??
    'Rough day to ride'
  );
}

function poorDayReason(
  { wind, rain, high, low, temp, dewpoint }: DayMetrics,
  tempUnit: TempUnit = 'fahrenheit',
): string {
  return (
    poorConditionReasons({ wind, rain, high, low, temp, dewpoint }, tempUnit)[0] ?? 'Tough riding'
  );
}

function marginalDayReason(
  { wind, rain, high, low, temp, dewpoint }: DayMetrics,
  tempUnit: TempUnit = 'fahrenheit',
): string {
  return (
    marginalConditionReasons({ wind, rain, high, low, temp, dewpoint }, tempUnit)[0] ??
    'Mixed conditions'
  );
}

function fairDayReason({ wind, rain, high }: DayMetrics): string {
  if (wind >= 12) return 'Breezy';
  if (rain > 15) return 'Chance of rain';
  if (high != null && high < 50) return 'Cool but clear';
  if (high != null && high > 87) return 'Warm but workable';
  return 'Fair window';
}

function idealDayReason({ wind, rain, high }: DayMetrics): string {
  if (rain <= 10 && wind <= 8) return 'Low wind and dry';
  if (high != null && high < 50 && rain <= 20) return 'Cool and clear';
  if (high != null && high > 80 && rain <= 20) return 'Warm and dry';
  if (wind <= 10) return 'Calm and steady';
  if (rain <= 20) return 'Comfortable and dry';
  return 'Prime riding weather';
}

const HOUR_REASON_FALLBACK: Record<string, string> = {
  bad: 'Rough day to ride',
  poor: 'Tough riding',
  marginal: 'Mixed conditions',
};

function hourWindReason(windSpeed: number): string | null {
  const wind = Math.round(windSpeed);
  if (wind >= 20) return ISSUE_PHRASES.WIND(wind, 'bad');
  if (wind >= 18) return ISSUE_PHRASES.WIND(wind, 'poor');
  if (wind >= 15) return ISSUE_PHRASES.WIND(wind, 'marginal');
  return null;
}

function hourRainReason(rain: number): string | null {
  const pct = formatPercent(rain);
  if (rain >= 60) return ISSUE_PHRASES.RAIN(pct, 'bad');
  if (rain >= 45) return ISSUE_PHRASES.RAIN(pct, 'poor');
  if (rain >= 30) return ISSUE_PHRASES.RAIN(pct, 'marginal');
  return null;
}

function hourTempReason(temp: number, tempUnit: TempUnit, thresholds: Thresholds): string | null {
  const t = thresholds.TEMPERATURE;
  const label = formatTemperature(temp, tempUnit);
  if (temp > t.BAD_MAX) return ISSUE_PHRASES.HEAT(label, 'bad');
  if (temp > t.POOR_MAX) return ISSUE_PHRASES.HEAT(label, 'poor');
  if (temp > t.MARGINAL_MAX) return ISSUE_PHRASES.HEAT(label, 'marginal');
  if (temp < 32) return ISSUE_PHRASES.COLD(label, 'bad');
  if (temp < 36) return ISSUE_PHRASES.COLD(label, 'poor');
  if (temp < 45) return ISSUE_PHRASES.COLD(label, 'marginal');
  return null;
}

function hourDewReason(
  dewpoint: number | null,
  tempUnit: TempUnit,
  thresholds: Thresholds,
): string | null {
  if (dewpoint == null) return null;
  const d = thresholds.DEWPOINT;
  const dewLabel = formatTemperature(dewpoint, tempUnit);
  if (dewpoint > d.BAD) return ISSUE_PHRASES.HUMIDITY(dewLabel, 'bad');
  if (dewpoint > d.POOR) return ISSUE_PHRASES.HUMIDITY(dewLabel, 'poor');
  if (dewpoint > d.MARGINAL) return ISSUE_PHRASES.HUMIDITY(dewLabel, 'marginal');
  return null;
}

export function getHourConditionReasons(
  hour: HourlyWeather,
  tempUnit: TempUnit = 'fahrenheit',
  thresholds: Thresholds = THRESHOLDS,
): string[] {
  const reasons: string[] = [];
  const codeReason = weatherCodeReason(hour);
  if (codeReason) reasons.push(codeReason);

  if (hour.condition === 'good' || hour.condition === 'fair') return reasons;

  // Rate each metric on its own (strongest phrasing that applies) rather than
  // gating every metric behind the hour's overall tier — an hour dragged into
  // "bad" by one metric still names the others, keeping the drawer consistent
  // with the verdict hero's per-metric issue chips.
  const metricReasons = [
    hourWindReason(hour.windSpeed),
    hourRainReason(hour.rainChance),
    hourTempReason(hour.temperature, tempUnit, thresholds),
    hourDewReason(hour.dewpoint ?? null, tempUnit, thresholds),
  ].filter((reason): reason is string => reason != null);
  reasons.push(...metricReasons);

  if (reasons.length === 0) {
    reasons.push(HOUR_REASON_FALLBACK[hour.condition] ?? 'Mixed conditions');
  }

  return reasons;
}

/** Builds a short explanation for why a daily card rates the way it does. */
export function getDayConditionReason(
  day: DailyWeather,
  tempUnit: TempUnit = 'fahrenheit',
): string {
  if (day.rideWindowUnavailable) return 'No three-hour daylight window left';
  const codeReason = weatherCodeReason(day);
  if (codeReason) return codeReason;

  const m = dayMetrics(day);
  switch (day.condition) {
    case 'bad': {
      return badDayReason(m, tempUnit);
    }
    case 'poor': {
      return poorDayReason(m, tempUnit);
    }
    case 'marginal': {
      return marginalDayReason(m, tempUnit);
    }
    case 'fair': {
      return fairDayReason(m);
    }
    default: {
      return idealDayReason(m);
    }
  }
}
