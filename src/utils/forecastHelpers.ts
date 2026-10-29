import { THRESHOLDS, type Thresholds } from '../domain/constants';
import { ISSUE_PHRASES, issuePhraseTier, STATUS_MESSAGES, type IssueTier } from '../domain/copy';
import { rainPhrase } from '../domain/ride-factors';
import { heatIndex } from '../domain/heat-index';
import {
  evaluateColdRainHazard,
  evaluateCondition,
  evaluateRain,
  evaluateWind,
  isColdTemp,
  getLimitingHeatIndex,
  isGustDriven,
  RANK,
} from '../domain/scoring';
import { getWeatherCodeCondition, isSnowy } from '../domain/weather-codes';
import { formatPercent } from './percent';
import { formatTemperature, formatWindSpeed } from './temperature';
import { formatHourSpan } from './timeFormat';

import type { Condition, DailyWeather, HourlyWeather } from '@/types/weather';
import type { TempUnit } from './temperature';

const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STORM_CODES = new Set([95, 96, 99]);
// Freezing fog and freezing drizzle or rain: ice on the road, rated bad.
const ICE_CODES = new Set([48, 56, 57, 66, 67]);
const HEAVY_RAIN_CODES = new Set([65, 82]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);

/** Returns "Today" for index 0, otherwise a short label like "Mon 24". */
export function dayLabel(date: Date | string, index: number): string {
  if (index === 0) return 'Today';
  // Matches the verdict and kit, which already say "Tomorrow".
  if (index === 1) return 'Tomorrow';
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

function bestDayRationale(
  day: DailyWeather,
  tempUnit: TempUnit = 'fahrenheit',
  thresholds: Thresholds = THRESHOLDS,
): string {
  if (day.condition === 'fair') return getDayConditionReason(day, tempUnit, thresholds);

  const rain = day.rainChance;
  const wind = day.windSpeed;
  const gust = day.windGust ?? wind;
  const high = day.rideWindow?.tempHigh ?? day.high;
  const warmThreshold = 80 + (thresholds.TEMPERATURE.FAIR_MAX - THRESHOLDS.TEMPERATURE.FAIR_MAX);
  if (rain <= 10 && wind <= 8 && gust <= 15) return 'Low wind and dry roads';
  if (gust > 15) return 'Mostly calm with manageable gusts';
  if (high < thresholds.TEMPERATURE.FAIR_MIN && rain <= 20) return 'Cool and clear';
  if (high > warmThreshold && rain <= 20) return 'Warm and dry';
  if (wind <= 10) return 'Calm and steady';
  if (rain <= 20) return 'Comfortable and dry';
  return 'Solid riding weather';
}

/** Finds the index and rationale of the single best day for cycling in the 8-day forecast. */
export function getBestDayInfo(
  daily: DailyWeather[] | null | undefined,
  tempUnit: TempUnit = 'fahrenheit',
  thresholds: Thresholds = THRESHOLDS,
): {
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

  return { index: bestIdx, rationale: bestDayRationale(bestDay, tempUnit, thresholds) };
}

interface DayMetrics {
  wind: number;
  gust: number | null;
  rain: number;
  precip: number | null;
  high: number | null;
  low: number | null;
  temp: number | null;
  dewpoint: number | null;
  /** Whether the window's precipitation falls as snow. */
  snowy: boolean;
  heatIndex: number | null;
}

function dayMetrics(day: DailyWeather): DayMetrics {
  const high = day.rideWindow?.tempHigh ?? day.high;
  const low = day.rideWindow?.tempLow ?? day.low;
  return {
    wind: Math.round(day.windSpeed),
    gust: day.windGust ?? null,
    rain: day.rainChance,
    precip: day.precipitation ?? null,
    high,
    low,
    // Daily reasons describe the selected ride window rather than overnight or
    // brief outlier conditions elsewhere in the day.
    temp: high,
    dewpoint: day.dewpoint ?? null,
    snowy: isSnowy(high, day.weatherCode),
    // Older caches lack the window's peak; the rating worked it out the same way.
    heatIndex: day.heatIndexMax ?? heatIndex(high, day.dewpoint),
  };
}

interface HourReason {
  text: string;
  tier: IssueTier;
}

/** The heat index as a reason, for a limiting index (`getLimitingHeatIndex`); it rates poor. */
function heatIndexReason(
  limitingIndex: number | null,
  label: (index: number) => string,
): HourReason | null {
  return limitingIndex == null
    ? null
    : { text: ISSUE_PHRASES.HEAT_INDEX(label(limitingIndex)), tier: 'poor' };
}

/** Names the sky when it limits the ride, at the tier the code itself rates. */
function weatherCodeReason(entry: { weatherCode: number | null }): HourReason | null {
  const code = entry.weatherCode;
  if (code == null) return null;
  let text: string | null = null;
  if (STORM_CODES.has(code)) text = 'Storm risk';
  else if (ICE_CODES.has(code)) text = 'Icy roads';
  else if (SNOW_CODES.has(code)) text = 'Wintry roads';
  else if (HEAVY_RAIN_CODES.has(code)) text = 'Heavy rain risk';
  const tier = issuePhraseTier(getWeatherCodeCondition(code));
  return text && tier ? { text, tier } : null;
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
  { wind, gust, rain, precip, low, temp, dewpoint, snowy, heatIndex: dayHeatIndex }: DayMetrics,
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
        ? ISSUE_PHRASES.GUSTS(formatWindSpeed(gust ?? wind, tempUnit), windTier)
        : ISSUE_PHRASES.WIND(formatWindSpeed(wind, tempUnit), windTier),
      tier: windTier,
    });
  }

  const rainTier = issuePhraseTier(evaluateRain(rain, precip, thresholds));
  if (rainTier)
    reasons.push({ text: rainPhrase(rain, precip, rainTier, thresholds, snowy), tier: rainTier });

  const heatReason = heatIndexReason(
    getLimitingHeatIndex({ index: dayHeatIndex, temp, dewpoint }, thresholds),
    (index) => formatTemperature(index, tempUnit),
  );
  if (heatReason) reasons.push(heatReason);

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
    // Rate the day's low against the shared temperature band so the phrase tier
    // always matches the rating the table produced — hardcoded cutoffs here used
    // to explain a marginal-rated day in poor-tier language ("Cold start").
    // The cold side has no poor zone (POOR_MIN==BAD_MIN), so only bad and
    // marginal can occur. When the ride window's high also stays in the
    // marginal cold band, name the all-window cold rather than "Cool start".
    const lowTier = issuePhraseTier(evaluateCondition(low, 'temperature', thresholds));
    if (lowTier === 'bad') {
      reasons.push({ text: 'Freezing temps', tier: 'bad' });
    } else if (lowTier === 'marginal') {
      const highIsMarginalCold =
        temp != null &&
        isColdTemp(temp) &&
        evaluateCondition(temp, 'temperature', thresholds) === 'marginal';
      reasons.push({
        text: highIsMarginalCold
          ? ISSUE_PHRASES.COLD(formatTemperature(temp, tempUnit), 'marginal')
          : 'Cool start',
        tier: 'marginal',
      });
    }
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
function dayReasonAtTier(
  metrics: DayMetrics,
  tier: IssueTier,
  tempUnit: TempUnit,
  thresholds: Thresholds,
): string | null {
  return (
    dayMetricReasons(metrics, tempUnit, thresholds).find((r) => RANK[r.tier] <= RANK[tier])?.text ??
    null
  );
}

// What a day's reason falls back to when no metric explains its rating. They
// name no cause, so the week row's note (`getDayRowNote`) leaves them out.
const DAY_REASON_FALLBACK = {
  bad: 'Rough day to ride',
  poor: 'Tough riding',
  marginal: 'Mixed conditions',
  fair: 'Fair window',
} as const;
const GENERIC_DAY_REASONS: ReadonlySet<string> = new Set(Object.values(DAY_REASON_FALLBACK));

function badDayReason(metrics: DayMetrics, tempUnit: TempUnit, thresholds: Thresholds): string {
  return dayReasonAtTier(metrics, 'bad', tempUnit, thresholds) ?? DAY_REASON_FALLBACK.bad;
}

function poorDayReason(metrics: DayMetrics, tempUnit: TempUnit, thresholds: Thresholds): string {
  return dayReasonAtTier(metrics, 'poor', tempUnit, thresholds) ?? DAY_REASON_FALLBACK.poor;
}

function marginalDayReason(
  metrics: DayMetrics,
  tempUnit: TempUnit,
  thresholds: Thresholds,
): string {
  return dayReasonAtTier(metrics, 'marginal', tempUnit, thresholds) ?? DAY_REASON_FALLBACK.marginal;
}

function fairDayReason(
  { wind, rain, high }: DayMetrics,
  thresholds: Thresholds = THRESHOLDS,
): string {
  if (wind >= 12) return 'Breezy';
  if (rain > 15) return 'Chance of rain';
  if (high != null && high < thresholds.TEMPERATURE.FAIR_MIN) return 'Cool but clear';
  if (high != null && high > thresholds.TEMPERATURE.FAIR_MAX) return 'Warm but workable';
  return DAY_REASON_FALLBACK.fair;
}

function idealDayReason(
  { wind, rain, high }: DayMetrics,
  thresholds: Thresholds = THRESHOLDS,
): string {
  const warmThreshold = 80 + (thresholds.TEMPERATURE.FAIR_MAX - THRESHOLDS.TEMPERATURE.FAIR_MAX);
  if (rain <= 10 && wind <= 8) return 'Low wind and dry';
  if (high != null && high < thresholds.TEMPERATURE.FAIR_MIN && rain <= 20) return 'Cool and clear';
  if (high != null && high > warmThreshold && rain <= 20) return 'Warm and dry';
  if (wind <= 10) return 'Calm and steady';
  if (rain <= 20) return 'Comfortable and dry';
  return 'Prime riding weather';
}

function hourWindReason(
  windSpeed: number,
  windGust: number | null | undefined,
  tempUnit: TempUnit = 'fahrenheit',
  thresholds: Thresholds = THRESHOLDS,
): HourReason | null {
  const tier = issuePhraseTier(evaluateWind(windSpeed, windGust, thresholds));
  if (!tier) return null;
  // Name the metric that actually set the rating, matching the verdict hero
  // (`ride-factors.ts`) — otherwise a calm-but-gusty hour reads "Very windy
  // (8 mph)" because it borrows the gust's severity but the sustained number.
  const text = isGustDriven(windSpeed, windGust)
    ? ISSUE_PHRASES.GUSTS(formatWindSpeed(windGust ?? windSpeed, tempUnit), tier)
    : ISSUE_PHRASES.WIND(formatWindSpeed(windSpeed, tempUnit), tier);
  return { text, tier };
}

function hourAqiReason(aqi: number | null, thresholds: Thresholds = THRESHOLDS): HourReason | null {
  if (aqi == null) return null;
  const tier = issuePhraseTier(evaluateCondition(aqi, 'aqi', thresholds));
  return tier ? { text: ISSUE_PHRASES.AQI(Math.round(aqi), tier), tier } : null;
}

function hourRainReason(
  hour: HourlyWeather,
  thresholds: Thresholds,
  snowy: boolean,
): HourReason | null {
  const { rainChance: rain, precipitation: precip } = hour;
  const tier = issuePhraseTier(evaluateRain(rain, precip, thresholds));
  if (!tier) return null;
  return { text: rainPhrase(rain, precip, tier, thresholds, snowy), tier };
}

function hourTempReason(
  temp: number,
  tempUnit: TempUnit,
  thresholds: Thresholds = THRESHOLDS,
): HourReason | null {
  const tier = issuePhraseTier(evaluateCondition(temp, 'temperature', thresholds));
  if (!tier) return null;
  const label = formatTemperature(temp, tempUnit, {
    withUnitLabel: true,
  });
  const text = isColdTemp(temp) ? ISSUE_PHRASES.COLD(label, tier) : ISSUE_PHRASES.HEAT(label, tier);
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

function resolveHourRainReasons(
  hour: HourlyWeather,
  tempUnit: TempUnit,
  thresholds: Thresholds,
  codeReason: HourReason | null,
): {
  codeReason: HourReason | null;
  rainReason: HourReason | null;
  tempReason: HourReason | null;
} {
  const coldRain = evaluateColdRainHazard(
    {
      temp: hour.temperature,
      rainChance: hour.rainChance,
      precip: hour.precipitation,
      code: hour.weatherCode,
    },
    thresholds,
  );
  const coldRainTier = coldRain ? issuePhraseTier(coldRain) : null;
  const snowy = isSnowy(hour.temperature, hour.weatherCode);
  const rainReason = coldRainTier
    ? {
        text: ISSUE_PHRASES.COLD_RAIN(
          formatTemperature(hour.temperature, tempUnit, { withUnitLabel: true }),
          formatPercent(hour.rainChance),
          coldRainTier,
          snowy,
        ),
        tier: coldRainTier,
      }
    : hourRainReason(hour, thresholds, snowy);

  const tempReason = coldRainTier ? null : hourTempReason(hour.temperature, tempUnit, thresholds);

  let effectiveCodeReason = codeReason;
  let effectiveRainReason = rainReason;
  if (codeReason?.text === 'Heavy rain risk') {
    if (coldRainTier != null || rainReason?.tier === 'bad' || rainReason?.tier === 'poor') {
      effectiveCodeReason = null;
    } else if (rainReason != null) {
      effectiveRainReason = null;
    }
  }

  return {
    codeReason: effectiveCodeReason,
    rainReason: effectiveRainReason,
    tempReason,
  };
}

export interface HourReasonOptions {
  limit?: number;
}

/**
 * Returns prioritized, human-readable reason strings for an hour's condition rating,
 * ordered from most severe issue to least severe (e.g. ['Very windy (24 mph)', 'Rain likely (60%)']).
 * Drops fair-tier metrics when the hour is already poor or bad to keep focus on the true limiter.
 */
export function getHourConditionReasons(
  hour: HourlyWeather,
  tempUnit: TempUnit = 'fahrenheit',
  thresholds: Thresholds = THRESHOLDS,
  options?: HourReasonOptions,
): string[] {
  const codeReason = weatherCodeReason(hour);
  const {
    codeReason: effectiveCodeReason,
    rainReason: effectiveRainReason,
    tempReason,
  } = resolveHourRainReasons(hour, tempUnit, thresholds, codeReason);

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
    effectiveCodeReason,
    hourWindReason(hour.windSpeed, hour.windGust, tempUnit, thresholds),
    effectiveRainReason,
    heatIndexReason(
      getLimitingHeatIndex(
        {
          index: heatIndex(hour.temperature, hour.dewpoint),
          temp: hour.temperature,
          dewpoint: hour.dewpoint,
        },
        thresholds,
      ),
      (index) => formatTemperature(index, tempUnit, { withUnitLabel: true }),
    ),
    tempReason,
    hourDewReason(hour.dewpoint ?? null, tempUnit, thresholds),
    hourAqiReason(hour.aqi ?? null, thresholds),
  ].filter((reason): reason is HourReason => reason != null);

  const filtered = metricReasons.filter((r) => !(dropFairTier && r.tier === 'fair'));

  // Worst first: order by severity so the true limiter is always named first.
  // Stable sort preserves metric priority for ties within a tier.
  const sorted = [...filtered].sort((a, b) => RANK[a.tier] - RANK[b.tier]);

  // When a limit is specified, cap to the top reasons (e.g. limit: 1 for
  // the compact hourly drawer); 0 or unset returns all reasons in severity order.
  const limit = options?.limit ?? 0;
  const limited = limit > 0 ? sorted.slice(0, limit) : sorted;
  const reasons = limited.map((r) => r.text);

  if (reasons.length === 0 && hour.condition !== 'good' && hour.condition !== 'fair') {
    reasons.push(HOUR_REASON_FALLBACK[hour.condition] ?? 'Mixed conditions');
  }

  return reasons;
}

/**
 * Builds a short explanation for why a daily card rates the way it does.
 * `thresholds` must be the ones the day was rated with (the snapshot's
 * acclimatized table), or the reason can disagree with the card's rating.
 */
export function getDayConditionReason(
  day: DailyWeather,
  tempUnit: TempUnit = 'fahrenheit',
  thresholds: Thresholds = THRESHOLDS,
): string {
  if (day.rideWindowUnavailable) return 'Not enough daylight left to ride';
  const codeReason = weatherCodeReason(day);
  if (codeReason) return codeReason.text;

  const m = dayMetrics(day);
  switch (day.condition) {
    case 'bad': {
      return badDayReason(m, tempUnit, thresholds);
    }
    case 'poor': {
      return poorDayReason(m, tempUnit, thresholds);
    }
    case 'marginal': {
      return marginalDayReason(m, tempUnit, thresholds);
    }
    case 'fair': {
      return fairDayReason(m, thresholds);
    }
    case 'good': {
      return idealDayReason(m, thresholds);
    }
  }
}

/** True for a day reason that names no cause ("Fair window", "Tough riding"). */
export function isGenericDayReason(reason: string): boolean {
  return GENERIC_DAY_REASONS.has(reason);
}

/** "Very windy (24 mph)" → "Very windy": drops a reason's trailing figures. */
function withoutFigures(reason: string): string {
  const open = reason.lastIndexOf(' (');
  return open > 0 && reason.endsWith(')') ? reason.slice(0, open) : reason;
}

/** Ratings worth riding, so a day's window reads as a pick rather than "least bad". */
const RIDEABLE_DAY: ReadonlySet<Condition> = new Set(['good', 'fair', 'marginal']);

export interface DayRowNote {
  /** What holds the day back, without figures ("Windy"); null on good days. */
  reason: string | null;
  /** The recommended ride window, outlined on the row's strip; null on no-go days. */
  window: { startHour: number; endHour: number } | null;
}

/**
 * What the week row says about a day beyond its rating: what holds it back,
 * and when to ride. Good days need no reason, so they get only the window;
 * poor and bad days aren't worth a recommended window, so they get only the
 * reason; a day with no daylight left gets neither.
 *
 * The reason is the expanded drawer's own (`getDayConditionReason`) without its
 * figures, so the row and the drawer never disagree; reasons that name no
 * cause are left to the drawer. `thresholds` must be the ones the day was
 * rated with, as for that function.
 */
export function getDayRowNote(
  day: DailyWeather,
  tempUnit: TempUnit = 'fahrenheit',
  thresholds: Thresholds = THRESHOLDS,
): DayRowNote {
  if (day.rideWindowUnavailable) return { reason: null, window: null };
  let reason: string | null = null;
  if (day.condition !== 'good') {
    const text = withoutFigures(getDayConditionReason(day, tempUnit, thresholds));
    if (!isGenericDayReason(text)) reason = text;
  }
  const window =
    day.rideWindow && RIDEABLE_DAY.has(day.condition)
      ? { startHour: day.rideWindow.startHour, endHour: day.rideWindow.endHour }
      : null;
  return { reason, window };
}

/**
 * The row note's text: "Breezy · Best 10 AM–1 PM". The week's best day leads
 * with its own "Best bet" label, so its window drops the "Best" ("Breezy ·
 * 10 AM–1 PM"). Null when there's nothing to say.
 */
export function formatDayRowNote(note: DayRowNote, best: boolean): string | null {
  const range = note.window ? formatHourSpan(note.window.startHour, note.window.endHour) : null;
  const windowText = range && !best ? STATUS_MESSAGES.BEST_WINDOW(range) : range;
  const parts = [note.reason, windowText].filter((part): part is string => part != null);
  return parts.length > 0 ? parts.join(' · ') : null;
}
