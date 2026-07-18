import { GEAR_TIPS } from './copy';
import { formatTemperature, type TempUnit } from '../utils/temperature';

import type { GearSuggestion, GearTip, GearTipItem, RideStatus, Weather } from '@/types/weather';

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
  PERFECT: () => GearTip;
  NEUTRAL: GearTip;
  TEMP_SWING: (min: string, max: string) => GearTip;
  RAIN_HIGH: GearTip;
  RAIN_COMING: GearTip;
  RAIN_POSSIBLE: GearTip;
  RAIN_LATER: GearTip;
  WINDY: GearTip;
  WIND_PICKUP: (speed: number) => GearTip;
  UV_EXTREME: () => GearTip;
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

const resolveTip = (tip: GearTip | (() => GearTip)): GearTip =>
  typeof tip === 'function' ? tip() : tip;

function getTemperatureTips(w: RideWindow, tipsSet: GearTipSet): GearTip[] {
  const tips: GearTip[] = [];

  if (w.minTemp < 32) tips.push(resolveTip(tipsSet.FREEZING));
  else if (w.minTemp < 45) tips.push(resolveTip(tipsSet.COLD));
  else if (w.minTemp < 55) tips.push(resolveTip(tipsSet.COOL));
  else if (w.minTemp < 65) tips.push(resolveTip(tipsSet.MILD_COOL));

  if (w.maxTemp > 90) tips.push(resolveTip(tipsSet.SCORCHING));
  else if (w.maxTemp > 80) tips.push(resolveTip(tipsSet.HOT));

  return tips;
}

/**
 * Builds the weather-driven add-on tips (rain, wind, UV, temp swing, mugginess).
 * `hasAdverse` flags conditions that contradict the ideal-day PERFECT copy.
 */
function buildSupportingTips(
  weather: Weather,
  w: RideWindow,
  tipsSet: GearTipSet,
  tempUnit: TempUnit = 'fahrenheit',
): { tips: GearTip[]; hasAdverse: boolean } {
  const tips: GearTip[] = [];
  let hasAdverse = false;

  if (w.maxTemp - w.minTemp >= 15) {
    tips.push(
      tipsSet.TEMP_SWING(
        formatTemperature(w.minTemp, tempUnit),
        formatTemperature(w.maxTemp, tempUnit),
      ),
    );
  }

  if (w.maxRain > 50) {
    tips.push(resolveTip(weather.rainChance > 50 ? tipsSet.RAIN_HIGH : tipsSet.RAIN_COMING));
    hasAdverse = true;
  } else if (w.maxRain > 30) {
    tips.push(resolveTip(weather.rainChance > 30 ? tipsSet.RAIN_POSSIBLE : tipsSet.RAIN_LATER));
    hasAdverse = true;
  }

  if (w.maxWind > 15) {
    tips.push(
      resolveTip(
        weather.windSpeed > 15 ? tipsSet.WINDY : tipsSet.WIND_PICKUP(Math.round(w.maxWind)),
      ),
    );
    hasAdverse = true;
  }
  if (w.maxUv >= 8) tips.push(tipsSet.UV_EXTREME());
  else if (w.maxUv >= 6) tips.push(resolveTip(tipsSet.UV_HIGH));
  if (w.maxDewpoint > 65) {
    tips.push(resolveTip(tipsSet.MUGGY));
    hasAdverse = true;
  }

  return { tips, hasAdverse };
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
  weather: Weather,
  w: RideWindow,
  tipsSet: GearTipSet,
  status: RideStatus | undefined,
  tempUnit: TempUnit = 'fahrenheit',
): GearSuggestion {
  const temperatureTips = getTemperatureTips(w, tipsSet);
  const { tips: supportingTips, hasAdverse } = buildSupportingTips(weather, w, tipsSet, tempUnit);

  // An empty temperature tip means the ride window sits in the ideal band, so
  // lead with PERFECT unless an adverse add-on contradicts it. NEUTRAL is the
  // quiet fallback for ideal temps paired with a genuine weather caveat. The
  // celebratory PERFECT copy only fits a clear "yes" day — on a maybe/no verdict
  // it contradicts the hero, so fall back to NEUTRAL.
  let baseTips: GearTip[];
  if (temperatureTips.length > 0) {
    baseTips = temperatureTips;
  } else if (hasAdverse || (status != null && status !== 'yes')) {
    baseTips = [resolveTip(tipsSet.NEUTRAL)];
  } else {
    baseTips = [tipsSet.PERFECT()];
  }

  const tips = [
    ...baseTips.map((tip) => ({ tip, base: true })),
    ...supportingTips.map((tip) => ({ tip, base: false })),
  ];
  const headline = tips.find(({ tip }) => tip.headline)?.tip.headline ?? '';
  const merged = mergeTipItems(tips);
  return {
    headline,
    items: merged.map(({ item }) => item),
    wear: merged.filter(({ group }) => group === 'wear').map(({ item }) => item),
    bring: merged.filter(({ group }) => group === 'bring').map(({ item }) => item),
  };
}

export const getGearSuggestion = (
  weather: Weather,
  mode: 'casual' | 'pro' = 'casual',
  status?: RideStatus,
  tempUnit: TempUnit = 'fahrenheit',
): GearSuggestion => {
  const w = getRideWindow(weather);
  const tipsSet: GearTipSet = mode === 'pro' ? GEAR_TIPS.PRO : GEAR_TIPS.CASUAL;
  return getGearTips(weather, w, tipsSet, status, tempUnit);
};
