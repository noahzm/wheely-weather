import { RAIN_AMOUNT_MM, UV_GEAR, WET_ROADS_THRESHOLD } from './constants';
import { GEAR_TIPS } from './copy';

import type { GearSuggestion, GearTip, GearTipItem, HourlyWeather, Weather } from '@/types/weather';

interface RideWindow {
  minTemp: number;
  maxTemp: number;
  maxWind: number;
  maxRain: number;
  /** Heaviest expected hourly amount (mm); null if any hour lacks one. */
  maxPrecip: number | null;
  maxDewpoint: number;
  maxUv: number;
}

interface GearTipSet {
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

const RIDE_WINDOW_HOURS = 3;
// Above this, even the coolest hour is hot: wind is relief, not a reason to pack
// a windbreaker.
const WINDBREAKER_MAX_TEMP = 80;

/** The verdict's ride window, as local hours [start, end). */
export interface RideHours {
  startHour: number;
  endHour: number;
}

/**
 * The hours the kit dresses for: the verdict's window when there is one (so a
 * wet 9 AM doesn't dress a dry noon ride), else the next few hours. `hourly`
 * starts at the current hour and spans a day, so each hour of day appears once.
 */
function selectRideHours(weather: Weather, rideHours: RideHours | null): HourlyWeather[] {
  if (!rideHours) return weather.hourly.slice(0, RIDE_WINDOW_HOURS);
  return weather.hourly.filter((h) => h.hour >= rideHours.startHour && h.hour < rideHours.endHour);
}

interface BeforeRide {
  /** The last `WET_ROADS_THRESHOLD.RECENT_HOURS` hours before the ride starts. */
  hours: HourlyWeather[];
  /** How many hours from now the ride starts (0 when it starts now). */
  hoursUntilRide: number;
}

/** The hours just before the ride: past hours, then any forecast hours before a later window. */
function selectHoursBeforeRide(weather: Weather, rideHours: RideHours | null): BeforeRide {
  const startIndex = rideHours
    ? weather.hourly.findIndex((h) => h.hour === rideHours.startHour)
    : 0;
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

function getRideWindow(weather: Weather, rideHours: RideHours | null): RideWindow {
  const upcoming = selectRideHours(weather, rideHours);
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

function getTemperatureTips(w: RideWindow, tipsSet: GearTipSet): GearTip[] {
  const tips: GearTip[] = [];

  if (w.minTemp < 32) tips.push(tipsSet.FREEZING);
  else if (w.minTemp < 45) tips.push(tipsSet.COLD);
  else if (w.minTemp < 55) tips.push(tipsSet.COOL);
  else if (w.minTemp < 65) tips.push(tipsSet.MILD_COOL);

  if (w.maxTemp > 90) tips.push(tipsSet.SCORCHING);
  else if (w.maxTemp > 80) tips.push(tipsSet.HOT);

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
  const recentRain = before.hours.some(
    (h) => h.rainChance >= WET_ROADS_THRESHOLD.RECENT_RAIN_CHANCE,
  );
  return isWetCode || recentRain;
}

/** Builds the weather-driven add-on tips (rain, wet roads, wind, UV, temp swing, mugginess). */
function buildSupportingTips(
  w: RideWindow,
  tipsSet: GearTipSet,
  weather: Weather,
  before: BeforeRide,
): GearTip[] {
  const tips: GearTip[] = [];
  // A likely trace is a passing sprinkle, as the rating treats it: a light
  // layer covers it, not a rain jacket.
  const traceOnly = w.maxPrecip != null && w.maxPrecip < RAIN_AMOUNT_MM.TRACE;

  if (w.maxTemp - w.minTemp >= 15) tips.push(tipsSet.TEMP_SWING);
  if (w.maxRain > 50 && !traceOnly) tips.push(tipsSet.RAIN_HIGH);
  else if (w.maxRain > 30) tips.push(tipsSet.RAIN_POSSIBLE);
  else if (hasWetRoads(weather, w, before) && tipsSet.WET_ROADS) tips.push(tipsSet.WET_ROADS);

  if (w.maxWind > 15 && w.minTemp <= WINDBREAKER_MAX_TEMP) tips.push(tipsSet.WINDY);
  if (w.maxUv >= UV_GEAR.SUNGLASSES) tips.push(tipsSet.UV_EXTREME);
  else if (w.maxUv >= UV_GEAR.SUNSCREEN) tips.push(tipsSet.UV_HIGH);
  if (w.maxDewpoint > 65) tips.push(tipsSet.MUGGY);

  return tips;
}

interface MergedTipItem {
  item: GearTipItem;
  group: 'wear' | 'bring';
}

/**
 * Flattens tips into a deduplicated item list — later items win their slot.
 * Slotted items and slotless base-tip items form the outfit ('wear');
 * slotless supporting-tip items are add-ons to pack ('bring').
 */
function mergeTipItems(tips: { tip: GearTip; base: boolean }[]): MergedTipItem[] {
  const merged: MergedTipItem[] = [];
  for (const { tip, base } of tips) {
    for (const item of tip.items) {
      const group = item.slot || base ? 'wear' : 'bring';
      if (!item.slot) {
        merged.push({ item, group });
        continue;
      }
      const idx = merged.findIndex((existing) => existing.item.slot === item.slot);
      if (idx === -1) merged.push({ item, group });
      else merged[idx] = { item, group };
    }
  }
  return merged;
}

function getGearTips(
  w: RideWindow,
  tipsSet: GearTipSet,
  weather: Weather,
  before: BeforeRide,
): GearSuggestion {
  const temperatureTips = getTemperatureTips(w, tipsSet);
  const supportingTips = buildSupportingTips(w, tipsSet, weather, before);

  // An empty temperature tip means the ride window sits in the ideal band, so
  // NEUTRAL supplies the baseline outfit.
  const baseTips = temperatureTips.length > 0 ? temperatureTips : [tipsSet.NEUTRAL];

  const tips = [
    ...baseTips.map((tip) => ({ tip, base: true })),
    ...supportingTips.map((tip) => ({ tip, base: false })),
  ];
  const merged = mergeTipItems(tips);
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
): GearSuggestion => {
  const w = getRideWindow(weather, rideHours);
  const tipsSet: GearTipSet = mode === 'pro' ? GEAR_TIPS.PRO : GEAR_TIPS.CASUAL;
  return getGearTips(w, tipsSet, weather, selectHoursBeforeRide(weather, rideHours));
};

export function getWearRows(items: GearTipItem[], isWide: boolean): GearTipItem[][] {
  const n = items.length;
  if (n === 0) return [];
  if (!isWide) {
    const rows: GearTipItem[][] = [];
    for (let i = 0; i < n; i += 2) {
      rows.push(items.slice(i, i + 2));
    }
    return rows;
  }
  if (n <= 4) {
    return [items];
  }
  if (n === 5) {
    return [items.slice(0, 3), items.slice(3, 5)];
  }
  const rows: GearTipItem[][] = [];
  for (let i = 0; i < n; i += 3) {
    rows.push(items.slice(i, i + 3));
  }
  return rows;
}
