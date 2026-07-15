import { BEST_DAYS_MESSAGES } from '../domain/copy';
import { THRESHOLDS } from '../domain/constants';
import { formatPercent } from './percent';
import { formatTemperature } from './temperature';

import type { Condition, DailyWeather, HourlyWeather } from '@/types/weather';
import type { TempUnit } from './temperature';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
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

function hourMetrics(hour: HourlyWeather): DayMetrics {
  const temp = hour.temperature;
  return {
    wind: Math.round(hour.windSpeed),
    rain: hour.rainChance,
    high: null,
    low: temp,
    temp,
    dewpoint: hour.dewpoint ?? null,
  };
}

export function getHourConditionReasons(
  hour: HourlyWeather,
  tempUnit: TempUnit = 'fahrenheit',
): string[] {
  const reasons: string[] = [];
  const codeReason = weatherCodeReason(hour);
  if (codeReason) reasons.push(codeReason);

  if (hour.condition === 'good' || hour.condition === 'fair') return reasons;

  const m = hourMetrics(hour);
  switch (hour.condition) {
    case 'bad': {
      reasons.push(...badConditionReasons(m, tempUnit));
      if (reasons.length === 0) reasons.push('Rough day to ride');
      break;
    }
    case 'poor': {
      reasons.push(...poorConditionReasons(m, tempUnit));
      if (reasons.length === 0) reasons.push('Tough riding');
      break;
    }
    case 'marginal': {
      reasons.push(...marginalConditionReasons(m, tempUnit));
      if (reasons.length === 0) reasons.push('Mixed conditions');
      break;
    }
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

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function blurbDayLabel(day: DailyWeather, index: number): string {
  return index === 0 ? 'today' : (DAY_NAMES[new Date(day.date).getDay()] ?? '');
}

function joinDayLabels(labels: string[]): string {
  if (labels.length === 0) return '';
  if (labels.length === 1) return capitalize(labels[0] ?? '');
  if (labels.length === 2)
    return `${capitalize(labels[0] ?? '')} and ${capitalize(labels[1] ?? '')}`;
  const last = labels.at(-1) ?? '';
  const leading = labels
    .slice(0, -1)
    .map((label) => capitalize(label))
    .join(', ');
  return `${leading}, and ${capitalize(last)}`;
}

/** Builds a sentence listing the best cycling days this week. */
export function getBestDaysBlurb(
  daily: DailyWeather[],
  bestDayIdx: number,
  rationale: string,
): string {
  const rideableDays = daily
    .map((day, i) => ({ day, i, label: blurbDayLabel(day, i) }))
    .filter(
      ({ day }) =>
        !day.rideWindowUnavailable && (day.condition === 'good' || day.condition === 'fair'),
    )
    .map(({ i, label }) => ({ i, label }));

  if (rideableDays.length === 0) {
    return BEST_DAYS_MESSAGES.NONE();
  }

  const bestDay = rideableDays.find(({ i }) => i === bestDayIdx) ?? rideableDays[0];
  if (!bestDay) return BEST_DAYS_MESSAGES.NONE();
  const otherDays = rideableDays.filter(({ i }) => i !== bestDay.i).map(({ label }) => label);
  const descriptor = 'solid ride windows';

  const bestSentence =
    otherDays.length === 0
      ? `${capitalize(bestDay.label)} is your best ride window.`
      : `${capitalize(bestDay.label)} is the best bet.`;

  const rationaleSentence = rationale ? ` ${rationale} expected.` : '';
  if (otherDays.length === 0) {
    return `${bestSentence}${rationaleSentence}`;
  }

  // Past a few qualifying days, naming each one stops being scannable.
  if (otherDays.length >= 4) {
    return `${bestSentence}${rationaleSentence} Most of the week is rideable too.`;
  }

  const otherDaysSentence =
    otherDays.length === 1
      ? ` ${joinDayLabels(otherDays)} is a ${descriptor.replace(/s$/, '')} too.`
      : ` ${joinDayLabels(otherDays)} are ${descriptor} too.`;

  return `${bestSentence}${rationaleSentence}${otherDaysSentence}`;
}
