import { GEAR_TIPS } from './copy';

import type { GearSuggestion, GearTip, GearTipItem, Weather } from '@/types/weather';

interface RideWindow {
  minTemp: number;
  maxTemp: number;
  maxWind: number;
  maxRain: number;
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
  WINDY: GearTip;
  UV_EXTREME: GearTip;
  UV_HIGH: GearTip;
  MUGGY: GearTip;
}

const RIDE_WINDOW_HOURS = 3;

function getRideWindow(weather: Weather): RideWindow {
  const upcoming = weather.hourly.slice(0, RIDE_WINDOW_HOURS);
  const startConditions = upcoming[0] ?? weather;
  return {
    minTemp:
      upcoming.length > 0
        ? Math.min(...upcoming.map((h) => h.feelsLike))
        : startConditions.feelsLike,
    maxTemp:
      upcoming.length > 0
        ? Math.max(...upcoming.map((h) => h.feelsLike))
        : startConditions.feelsLike,
    maxWind:
      upcoming.length > 0
        ? Math.max(...upcoming.map((h) => h.windSpeed))
        : startConditions.windSpeed,
    maxRain:
      upcoming.length > 0
        ? Math.max(...upcoming.map((h) => h.rainChance))
        : startConditions.rainChance,
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

/** Builds the weather-driven add-on tips (rain, wind, UV, temp swing, mugginess). */
function buildSupportingTips(w: RideWindow, tipsSet: GearTipSet): GearTip[] {
  const tips: GearTip[] = [];

  if (w.maxTemp - w.minTemp >= 15) tips.push(tipsSet.TEMP_SWING);
  if (w.maxRain > 50) tips.push(tipsSet.RAIN_HIGH);
  else if (w.maxRain > 30) tips.push(tipsSet.RAIN_POSSIBLE);
  if (w.maxWind > 15) tips.push(tipsSet.WINDY);
  if (w.maxUv >= 8) tips.push(tipsSet.UV_EXTREME);
  else if (w.maxUv >= 6) tips.push(tipsSet.UV_HIGH);
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

function getGearTips(w: RideWindow, tipsSet: GearTipSet): GearSuggestion {
  const temperatureTips = getTemperatureTips(w, tipsSet);
  const supportingTips = buildSupportingTips(w, tipsSet);

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
): GearSuggestion => {
  const w = getRideWindow(weather);
  const tipsSet: GearTipSet = mode === 'pro' ? GEAR_TIPS.PRO : GEAR_TIPS.CASUAL;
  return getGearTips(w, tipsSet);
};
