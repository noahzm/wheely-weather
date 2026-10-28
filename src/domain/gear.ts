import {
  RAIN_AMOUNT_MM,
  THRESHOLDS,
  UV_GEAR,
  WET_ROADS_THRESHOLD,
  type Thresholds,
} from './constants';
import { GEAR_TIPS } from './copy';
import { ALL_DAY_RIDE_HOURS } from './ride-window';

import type {
  DailyWeather,
  GearSuggestion,
  GearTip,
  GearTipItem,
  HourlyWeather,
  Weather,
} from '@/types/weather';

/** The worst-case conditions over the hours a kit dresses for. */
export interface RideWindow {
  minTemp: number;
  maxTemp: number;
  maxWind: number;
  maxRain: number;
  /** Heaviest expected hourly amount (mm); null if any hour lacks one. */
  maxPrecip: number | null;
  maxDewpoint: number;
  maxUv: number;
}

export interface GearTipSet {
  FREEZING: GearTip;
  COLD: GearTip;
  COOL: GearTip;
  MILD_COOL: GearTip;
  HOT: GearTip;
  SCORCHING: GearTip;
  NEUTRAL: GearTip;
  TEMP_SWING: GearTip;
  RAIN_HIGH: GearTip;
  RAIN_POSSIBLE: GearTip;
  WET_ROADS?: GearTip;
  WINDY: GearTip;
  UV_EXTREME: GearTip;
  UV_HIGH: GearTip;
  MUGGY: GearTip;
}

/** Which tip an item came from: the weather that put it in the kit. */
export type GearTipKey = keyof GearTipSet;

/** One item in a merged kit, with the tip it came from. */
export interface KitEntry {
  item: GearTipItem;
  key: GearTipKey;
  /** The outfit ('wear') or an add-on to pack ('bring'), as `GearSuggestion` splits them. */
  group: 'wear' | 'bring';
}

const RIDE_WINDOW_HOURS = 3;
// Above this, the coolest hour already rates short sleeves without arm warmers
// (the NEUTRAL band), and a wind layer only overheats a rider working into the
// wind: it's relief, not a reason to pack a windbreaker.
const WINDBREAKER_MAX_TEMP = 65;
// How far the kit's cold bands follow a cold-adapted rider. The rating's cold
// shift reaches 18°F because kit does most of the cold adapting
// (deriveAcclimatization); following it fully put bib shorts and knee warmers
// on a 33°F ride. Riders used to the cold dress a little lighter, not a
// season lighter.
const KIT_MAX_COLD_SHIFT = 5;

/** The verdict's ride window, as local hours [start, end). */
export interface RideHours {
  startHour: number;
  endHour: number;
  /** True when the window is tomorrow, so overlapping evening hours today are skipped. */
  tomorrow?: boolean;
}

function findRideWindowIndices(hourly: HourlyWeather[], rideHours: RideHours): number[] {
  const tagged: { index: number; hour: number; afterMidnight: boolean }[] = [];
  let afterMidnight = false;
  let prevHour: number | null = null;
  for (const [index, h] of hourly.entries()) {
    if (prevHour != null && h.hour < prevHour) afterMidnight = true;
    prevHour = h.hour;
    tagged.push({ index, hour: h.hour, afterMidnight });
  }
  const matches = (targetAfterMidnight: boolean) =>
    tagged
      .filter(
        (entry) =>
          entry.afterMidnight === targetAfterMidnight &&
          entry.hour >= rideHours.startHour &&
          entry.hour < rideHours.endHour,
      )
      .map((entry) => entry.index);

  if (!rideHours.tomorrow) {
    const todayMatches = matches(false);
    return todayMatches.length > 0 ? todayMatches : matches(true);
  }
  return matches(true);
}

function daylightRideHours(weather: Weather): RideHours | null {
  const { daylight } = weather;
  if (!daylight || daylight.sunsetHour <= daylight.sunriseHour) return null;
  return { startHour: daylight.sunriseHour, endHour: daylight.sunsetHour };
}

/**
 * The hours the kit dresses for: the verdict's window when there is one (so a
 * wet 9 AM doesn't dress a dry noon ride), else the daylight hours for an
 * all-day ride or the next few hours. `hourly` starts at the current hour and
 * spans a day, so `tomorrow` disambiguates hours that repeat across midnight.
 */
export function selectRideHours(
  weather: Weather,
  rideHours: RideHours | null,
  defaultWindowHours: number = RIDE_WINDOW_HOURS,
): HourlyWeather[] {
  const effectiveHours =
    rideHours ?? (defaultWindowHours >= ALL_DAY_RIDE_HOURS ? daylightRideHours(weather) : null);
  if (!effectiveHours) {
    const fallbackHours =
      defaultWindowHours >= ALL_DAY_RIDE_HOURS ? RIDE_WINDOW_HOURS : defaultWindowHours;
    return weather.hourly.slice(0, fallbackHours);
  }
  return findRideWindowIndices(weather.hourly, effectiveHours)
    .map((i) => weather.hourly[i])
    .filter((h): h is HourlyWeather => h !== undefined);
}

export interface BeforeRide {
  /** The last `WET_ROADS_THRESHOLD.RECENT_HOURS` hours before the ride starts. */
  hours: HourlyWeather[];
  /** How many hours from now the ride starts (0 when it starts now). */
  hoursUntilRide: number;
}

/** The hours just before the ride: past hours, then any forecast hours before a later window. */
export function selectHoursBeforeRide(weather: Weather, rideHours: RideHours | null): BeforeRide {
  const indices = rideHours ? findRideWindowIndices(weather.hourly, rideHours) : [];
  const startIndex = indices[0] ?? 0;
  const hoursUntilRide = Math.max(startIndex, 0);
  const hours = [...weather.pastHourly, ...weather.hourly.slice(0, hoursUntilRide)].slice(
    -WET_ROADS_THRESHOLD.RECENT_HOURS,
  );
  return { hours, hoursUntilRide };
}

/** The heaviest expected amount, or null when any hour lacks one (so it can't understate rain). */
function maxPrecipitation(hours: { precipitation?: number | null }[]): number | null {
  const amounts = hours.map((h) => h.precipitation);
  return amounts.every((amount): amount is number => amount != null) ? Math.max(...amounts) : null;
}

export function getRideWindow(
  weather: Weather,
  rideHours: RideHours | null,
  defaultWindowHours: number = RIDE_WINDOW_HOURS,
): RideWindow {
  const upcoming = selectRideHours(weather, rideHours, defaultWindowHours);
  const startConditions = upcoming[0] ?? weather;
  return {
    minTemp:
      upcoming.length > 0
        ? Math.min(...upcoming.map((h) => h.temperature))
        : startConditions.temperature,
    maxTemp:
      upcoming.length > 0
        ? Math.max(...upcoming.map((h) => h.temperature))
        : startConditions.temperature,
    maxWind:
      upcoming.length > 0
        ? Math.max(...upcoming.map((h) => h.windSpeed))
        : startConditions.windSpeed,
    maxRain:
      upcoming.length > 0
        ? Math.max(...upcoming.map((h) => h.rainChance))
        : startConditions.rainChance,
    maxPrecip: maxPrecipitation(upcoming.length > 0 ? upcoming : [startConditions]),
    maxDewpoint:
      upcoming.length > 0
        ? Math.max(...upcoming.map((h) => h.dewpoint ?? 0))
        : (startConditions.dewpoint ?? 0),
    maxUv:
      upcoming.length > 0 ? Math.max(...upcoming.map((h) => h.uv ?? 0)) : (weather.uvIndex ?? 0),
  };
}

function getTemperatureTips(w: RideWindow, thresholds: Thresholds = THRESHOLDS): GearTipKey[] {
  const tips: GearTipKey[] = [];
  // Shift comfort bands by the rider's acclimatization relative to the standard
  // table, the cold side only a little (KIT_MAX_COLD_SHIFT). Freezing (< 32°F)
  // stays fixed because road ice and frostbite don't acclimatize.
  const coldShift = Math.min(
    THRESHOLDS.TEMPERATURE.FAIR_MIN - thresholds.TEMPERATURE.FAIR_MIN,
    KIT_MAX_COLD_SHIFT,
  );
  const tempShift = thresholds.TEMPERATURE.FAIR_MAX - THRESHOLDS.TEMPERATURE.FAIR_MAX;

  if (w.minTemp < 32) tips.push('FREEZING');
  else if (w.minTemp < 45 - coldShift) tips.push('COLD');
  else if (w.minTemp < 55 - coldShift) tips.push('COOL');
  else if (w.minTemp < 65 - coldShift) tips.push('MILD_COOL');

  if (w.maxTemp > 90 + tempShift) tips.push('SCORCHING');
  else if (w.maxTemp > 80 + tempShift) tips.push('HOT');

  return tips;
}

function hasWetRoads(weather: Weather, w: RideWindow, before: BeforeRide): boolean {
  if (w.maxRain > 30) return false;
  const code = weather.weatherCode;
  // Rain falling now only wets a ride that starts within the lookback.
  const isWetCode =
    code != null &&
    [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code) &&
    before.hoursUntilRide < WET_ROADS_THRESHOLD.RECENT_HOURS;
  // "Recent" rain means rain in the hours just before the ride starts: the past
  // hours, plus the forecast hours ahead of a later window (rain now, dry ride
  // at noon).
  const recentRain = before.hours.some((hour) => rainedInHour(hour));
  return isWetCode || recentRain;
}

/**
 * Whether an hour put water on the road: more than a trace when the amount is
 * known, since a 30% chance that came to nothing leaves the road dry; the
 * chance alone when it isn't.
 */
function rainedInHour(hour: HourlyWeather): boolean {
  if (hour.precipitation != null) return hour.precipitation >= RAIN_AMOUNT_MM.TRACE;
  return hour.rainChance >= WET_ROADS_THRESHOLD.RECENT_RAIN_CHANCE;
}

/** Builds the weather-driven add-on tips (rain, wet roads, wind, UV, temp swing, mugginess). */
function buildSupportingTips(
  w: RideWindow,
  weather: Weather,
  before: BeforeRide,
  thresholds: Thresholds = THRESHOLDS,
): GearTipKey[] {
  const tips: GearTipKey[] = [];
  // A likely trace is a passing sprinkle, as the rating treats it: a light
  // layer covers it, not a rain jacket.
  const traceOnly = w.maxPrecip != null && w.maxPrecip < RAIN_AMOUNT_MM.TRACE;

  if (w.maxRain > 50 && !traceOnly) tips.push('RAIN_HIGH');
  else if (w.maxRain > 30) tips.push('RAIN_POSSIBLE');
  else if (hasWetRoads(weather, w, before)) tips.push('WET_ROADS');

  // Wind before the temperature swing: a kit takes one outer layer
  // (mergeTipItems), and a wind layer also covers a cool start.
  if (w.maxWind > 15 && w.minTemp <= WINDBREAKER_MAX_TEMP) tips.push('WINDY');
  if (w.maxTemp - w.minTemp >= 15) tips.push('TEMP_SWING');
  if (w.maxUv >= UV_GEAR.SUNGLASSES) tips.push('UV_EXTREME');
  else if (w.maxUv >= UV_GEAR.SUNSCREEN) tips.push('UV_HIGH');
  if (w.maxDewpoint >= thresholds.DEWPOINT.MARGINAL) tips.push('MUGGY');

  return tips;
}

/**
 * Flattens tips into a deduplicated item list — later items win their slot.
 * Slotted items and slotless base-tip items form the outfit ('wear');
 * slotless supporting-tip items are add-ons to pack ('bring').
 * A kit takes one wind layer: an add-on's outer layer is dropped when the kit
 * already has one (no windbreaker over a jacket, no wind vest beside a gilet).
 * An item two tips share, like shoe covers for the cold and for the rain, is
 * listed once.
 */
function mergeTipItems(tips: { key: GearTipKey; tip: GearTip; base: boolean }[]): KitEntry[] {
  const merged: KitEntry[] = [];
  for (const { key, tip, base } of tips) {
    for (const item of tip.items) {
      const group = item.slot || base ? 'wear' : 'bring';
      if (!item.slot) {
        const hasOuter = merged.some((existing) => existing.item.outer);
        const listed = merged.some((existing) => existing.item.label === item.label);
        if (listed || (item.outer && !base && hasOuter)) continue;
        merged.push({ item, key, group });
        continue;
      }
      const idx = merged.findIndex((existing) => existing.item.slot === item.slot);
      if (idx === -1) merged.push({ item, key, group });
      else merged[idx] = { item, key, group };
    }
  }
  return merged;
}

/** The kit for a window: each item, the tip that put it there, and its group. */
export function buildKitEntries(
  w: RideWindow,
  tipsSet: GearTipSet,
  weather: Weather,
  before: BeforeRide,
  thresholds: Thresholds = THRESHOLDS,
): KitEntry[] {
  const temperatureTips = getTemperatureTips(w, thresholds);
  const supportingTips = buildSupportingTips(w, weather, before, thresholds);

  // An empty temperature tip means the ride window sits in the ideal band, so
  // NEUTRAL supplies the baseline outfit.
  const baseTips: GearTipKey[] = temperatureTips.length > 0 ? temperatureTips : ['NEUTRAL'];

  const tips = [
    ...baseTips.map((key) => ({ key, base: true })),
    ...supportingTips.map((key) => ({ key, base: false })),
  ].flatMap(({ key, base }) => {
    const tip = tipsSet[key];
    return tip ? [{ key, tip, base }] : [];
  });
  return mergeTipItems(tips);
}

function getGearTips(
  w: RideWindow,
  tipsSet: GearTipSet,
  weather: Weather,
  before: BeforeRide,
  thresholds: Thresholds = THRESHOLDS,
): GearSuggestion {
  const merged = buildKitEntries(w, tipsSet, weather, before, thresholds);
  return {
    items: merged.map(({ item }) => item),
    wear: merged.filter(({ group }) => group === 'wear').map(({ item }) => item),
    bring: merged.filter(({ group }) => group === 'bring').map(({ item }) => item),
  };
}

export const getGearSuggestion = (
  weather: Weather,
  mode: 'casual' | 'pro' = 'casual',
  rideHours: RideHours | null = null,
  thresholds: Thresholds = THRESHOLDS,
  defaultWindowHours: number = RIDE_WINDOW_HOURS,
): GearSuggestion => {
  const w = getRideWindow(weather, rideHours, defaultWindowHours);
  const tipsSet: GearTipSet = mode === 'pro' ? GEAR_TIPS.PRO : GEAR_TIPS.CASUAL;
  return getGearTips(w, tipsSet, weather, selectHoursBeforeRide(weather, rideHours), thresholds);
};

/**
 * Builds a kit suggestion for a single day in the 8-day forecast, using its
 * selected daylight ride window (or daytime high/low fallback).
 */
export function getDayGearSuggestion(
  day: DailyWeather,
  mode: 'casual' | 'pro' = 'casual',
  thresholds: Thresholds = THRESHOLDS,
): GearSuggestion {
  const minTemp = day.rideWindow?.tempLow ?? day.low;
  const maxTemp = day.rideWindow?.tempHigh ?? day.high;
  const w: RideWindow = {
    minTemp,
    maxTemp,
    maxWind: day.windSpeed,
    maxRain: day.rainChance,
    maxPrecip: day.precipitation ?? null,
    maxDewpoint: day.dewpoint ?? 0,
    maxUv: day.uvMax ?? 0,
  };
  const tipsSet: GearTipSet = mode === 'pro' ? GEAR_TIPS.PRO : GEAR_TIPS.CASUAL;
  const syntheticWeather = { weatherCode: day.weatherCode } as Weather;
  return getGearTips(w, tipsSet, syntheticWeather, { hours: [], hoursUntilRide: 0 }, thresholds);
}
