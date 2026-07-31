import { THRESHOLDS, type Thresholds } from '../domain/constants';
import { ISSUE_PHRASES, issuePhraseTier, type IssueTier } from '../domain/copy';
import {
  effectiveRideTemp,
  evaluateColdRainHazard,
  evaluateCondition,
  evaluateWind,
  isColdTemp,
  isGustDriven,
  RANK,
} from '../domain/scoring';
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
  gust: number | null;
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
    gust: day.windGust ?? null,
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

/**
 * Rates each of a day's metrics against the shared threshold table and phrases
 * it from ISSUE_PHRASES, in priority order (wind -> rain -> heat -> humidity ->
 * cold start). Previously each tier had its own hardcoded ladder (wind >= 20
 * counted as "bad") which disagreed with the very table `getDailyCondition`
 * uses to rate the day, so a card could be rated marginal and then explain
 * itself in bad-tier language.
 */
function dayMetricReasons(
  { wind, gust, rain, low, temp, dewpoint }: DayMetrics,
  tempUnit: TempUnit = 'fahrenheit',
  thresholds: Thresholds = THRESHOLDS,
): HourReason[] {
  const reasons: HourReason[] = [];

  // Rated on the worse of sustained and gusts, and named after whichever one
  // set it — a day can be rated bad by gusts alone, and used to fall back to
  // generic phrasing because the reason list never looked at them.
  const windTier = issuePhraseTier(evaluateWind(wind, gust, thresholds));
  if (windTier) {
    reasons.push({
      text: isGustDriven(wind, gust)
        ? ISSUE_PHRASES.GUSTS(Math.round(gust ?? wind), windTier)
        : ISSUE_PHRASES.WIND(wind, windTier),
      tier: windTier,
    });
  }

  const rainTier = issuePhraseTier(evaluateCondition(rain, 'rainChance', thresholds));
  if (rainTier)
    reasons.push({ text: ISSUE_PHRASES.RAIN(formatPercent(rain), rainTier), tier: rainTier });

  if (temp != null && temp >= 50) {
    // Daily temp reasons describe the ride window's high, so they read as heat;
    // the cold end is covered by the dedicated cold-start reasons below.
    const tempTier = issuePhraseTier(evaluateCondition(temp, 'temperature', thresholds));
    if (tempTier) {
      reasons.push({
        text: ISSUE_PHRASES.HEAT(formatTemperature(temp, tempUnit), tempTier),
        tier: tempTier,
      });
    }
  }

  if (dewpoint != null) {
    const dewTier = issuePhraseTier(evaluateCondition(dewpoint, 'dewpoint', thresholds));
    if (dewTier) {
      reasons.push({
        text: ISSUE_PHRASES.HUMIDITY(formatTemperature(dewpoint, tempUnit), dewTier),
        tier: dewTier,
      });
    }
  }

  if (low != null) {
    if (low < 32) reasons.push({ text: 'Freezing temps', tier: 'bad' });
    else if (low < 36) reasons.push({ text: 'Cold start', tier: 'poor' });
    else if (low < 45) reasons.push({ text: 'Cool start', tier: 'marginal' });
  }

  // Worst first: the day card shows a single reason, and it must be the one that
  // actually set the day's rating rather than whichever metric is listed first.
  // Sort is stable, so metric priority still breaks ties within a tier.
  return [...reasons].sort((a, b) => RANK[a.tier] - RANK[b.tier]);
}

/**
 * The day card's reason for a card already rated `tier`. Only reasons at that
 * severity or worse qualify — otherwise a day rated bad by something the metric
 * list cannot express would explain itself with a fair-tier "Warm (72°)"
 * instead of falling back to honest generic phrasing.
 */
function dayReasonAtTier(metrics: DayMetrics, tier: IssueTier, tempUnit: TempUnit): string | null {
  return dayMetricReasons(metrics, tempUnit).find((r) => RANK[r.tier] <= RANK[tier])?.text ?? null;
}

function badDayReason(
  { wind, gust, rain, high, low, temp, dewpoint }: DayMetrics,
  tempUnit: TempUnit = 'fahrenheit',
): string {
  return (
    dayReasonAtTier({ wind, gust, rain, high, low, temp, dewpoint }, 'bad', tempUnit) ??
    'Rough day to ride'
  );
}

function poorDayReason(
  { wind, gust, rain, high, low, temp, dewpoint }: DayMetrics,
  tempUnit: TempUnit = 'fahrenheit',
): string {
  return (
    dayReasonAtTier({ wind, gust, rain, high, low, temp, dewpoint }, 'poor', tempUnit) ??
    'Tough riding'
  );
}

function marginalDayReason(
  { wind, gust, rain, high, low, temp, dewpoint }: DayMetrics,
  tempUnit: TempUnit = 'fahrenheit',
): string {
  return (
    dayReasonAtTier({ wind, gust, rain, high, low, temp, dewpoint }, 'marginal', tempUnit) ??
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

/** Formats a concise, informative summary of an hour's key weather metrics. */
export function formatHourMetricsSummary(
  hour: HourlyWeather,
  tempUnit: TempUnit = 'fahrenheit',
): string[] {
  const parts: string[] = [];
  const tempLabel = formatTemperature(hour.temperature, tempUnit);
  if (Math.abs(hour.feelsLike - hour.temperature) >= 3) {
    const feelsLabel = formatTemperature(hour.feelsLike, tempUnit);
    parts.push(`${tempLabel} (feels ${feelsLabel})`);
  } else {
    parts.push(tempLabel);
  }

  const gust = hour.windGust ?? hour.windSpeed;
  const windVal = Math.round(hour.windSpeed);
  const gustVal = Math.round(gust);
  if (gustVal > windVal && gustVal >= 15) {
    parts.push(`${gustVal} mph gusts`);
  } else {
    parts.push(`${windVal} mph wind`);
  }

  if (hour.rainChance > 0) {
    parts.push(`${formatPercent(hour.rainChance)} rain`);
  }

  if (hour.dewpoint != null) {
    parts.push(`dew ${formatTemperature(hour.dewpoint, tempUnit)}`);
  }

  return parts;
}

interface HourReason {
  text: string;
  tier: IssueTier;
}

function hourWindReason(
  windSpeed: number,
  windGust?: number | null,
  thresholds: Thresholds = THRESHOLDS,
): HourReason | null {
  const tier = issuePhraseTier(evaluateWind(windSpeed, windGust, thresholds));
  if (!tier) return null;
  // Name the metric that actually set the rating, matching the verdict hero
  // (`ride-factors.ts`) — otherwise a calm-but-gusty hour reads "Very windy
  // (8 mph)" because it borrows the gust's severity but the sustained number.
  const text = isGustDriven(windSpeed, windGust)
    ? ISSUE_PHRASES.GUSTS(Math.round(windGust ?? windSpeed), tier)
    : ISSUE_PHRASES.WIND(Math.round(windSpeed), tier);
  return { text, tier };
}

function hourRainReason(rain: number, thresholds: Thresholds = THRESHOLDS): HourReason | null {
  const tier = issuePhraseTier(evaluateCondition(rain, 'rainChance', thresholds));
  if (!tier) return null;
  return { text: ISSUE_PHRASES.RAIN(formatPercent(rain), tier), tier };
}

function hourTempReason(
  temp: number,
  tempUnit: TempUnit,
  thresholds: Thresholds = THRESHOLDS,
  feelsLike?: number | null,
): HourReason | null {
  const tier = issuePhraseTier(evaluateCondition(temp, 'temperature', thresholds, feelsLike));
  if (!tier) return null;
  // Label the temperature the rating was taken on, not the raw air temperature.
  const label = formatTemperature(effectiveRideTemp(temp, feelsLike), tempUnit, {
    withUnitLabel: true,
  });
  const text = isColdTemp(temp, feelsLike)
    ? ISSUE_PHRASES.COLD(label, tier)
    : ISSUE_PHRASES.HEAT(label, tier);
  return { text, tier };
}

function hourDewReason(
  dewpoint: number | null,
  tempUnit: TempUnit,
  thresholds: Thresholds = THRESHOLDS,
): HourReason | null {
  if (dewpoint == null) return null;
  const tier = issuePhraseTier(evaluateCondition(dewpoint, 'dewpoint', thresholds));
  if (!tier) return null;
  const text = ISSUE_PHRASES.HUMIDITY(
    formatTemperature(dewpoint, tempUnit, { withUnitLabel: true }),
    tier,
  );
  return { text, tier };
}

// Last-resort phrasing for an hour whose rating comes from something no
// per-metric reason covers, so the drawer is never blank on a non-good hour.
const HOUR_REASON_FALLBACK: Record<string, string> = {
  bad: 'Rough hour to ride',
  poor: 'Tough riding',
  marginal: 'Mixed conditions',
};

export function getHourConditionReasons(
  hour: HourlyWeather,
  tempUnit: TempUnit = 'fahrenheit',
  thresholds: Thresholds = THRESHOLDS,
): string[] {
  const reasons: string[] = [];
  const codeReason = weatherCodeReason(hour);
  if (codeReason) reasons.push(codeReason);

  // Cold + rain is a hypothermia hazard that outranks either metric alone, so
  // it replaces the plain rain reason rather than sitting alongside it — same
  // precedence the verdict hero uses (`ride-factors.ts`).
  const coldRain = evaluateColdRainHazard(hour.temperature, hour.rainChance, hour.weatherCode);
  const coldRainTier = coldRain ? issuePhraseTier(coldRain) : null;
  const rainReason = coldRainTier
    ? {
        text: ISSUE_PHRASES.COLD_RAIN(
          formatTemperature(hour.temperature, tempUnit, { withUnitLabel: true }),
          formatPercent(hour.rainChance),
          coldRainTier,
        ),
        tier: coldRainTier,
      }
    : hourRainReason(hour.rainChance, thresholds);

  // A fair-rated metric is not what limits an hour that is already marginal or
  // worse, so it is dropped there — otherwise a bad hour trails "Warm" and
  // "Humid" behind the reason it is actually bad. On a fair hour those same
  // metrics ARE the explanation, so they stay.
  // Mirrors the verdict hero's inclusion rule (`ride-factors.ts`): a marginal
  // hour still lists its fair-rated metrics (they are part of why it is only
  // marginal), but a poor/bad hour drops them so the real limiter is not
  // trailed by "Warm" and "Humid".
  const dropFairTier = hour.condition === 'poor' || hour.condition === 'bad';

  const metricReasons = [
    hourWindReason(hour.windSpeed, hour.windGust, thresholds),
    rainReason,
    hourTempReason(hour.temperature, tempUnit, thresholds, hour.feelsLike),
    hourDewReason(hour.dewpoint ?? null, tempUnit, thresholds),
  ].filter((reason): reason is HourReason => reason != null);
  reasons.push(
    ...metricReasons.filter((r) => !(dropFairTier && r.tier === 'fair')).map((r) => r.text),
  );

  if (reasons.length === 0 && hour.condition !== 'good' && hour.condition !== 'fair') {
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
