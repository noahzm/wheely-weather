import { DEFAULT_EXPOSURE_LEVEL, type ExposureLevel } from '../types/settings';
import type { HomeBaseline } from '@/types/weather';
import { THRESHOLDS, type Thresholds } from './constants';

export interface Acclimatization {
  tempShift: number;
  dewShift: number;
}

// Warm-exposure anchors for the "default" temperate recreational rider the base
// thresholds encode. A temperate home (summer high ~80°F, dew ~60°F) yields ~zero
// shift; only genuinely hotter/more-humid homes move the comfort dials.
const REF_TEMP = 80;
const REF_DEW = 60;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Derives how much warmer/muggier conditions a home-acclimatized rider tolerates,
 * relative to the base (temperate) thresholds. Only positive (warm/humid) shifts —
 * cold and wind are out of scope (the body doesn't acclimatize to them the same way).
 */
export const deriveAcclimatization = (
  homeBaseline: HomeBaseline | null | undefined,
  exposureLevel: ExposureLevel = DEFAULT_EXPOSURE_LEVEL,
): Acclimatization => {
  if (!homeBaseline || exposureLevel === 'indoor') return { tempShift: 0, dewShift: 0 };
  const factor = exposureLevel === 'high' ? 0.65 : 0.35;
  const maxTempShift = exposureLevel === 'high' ? 7 : 4;
  const maxDewShift = exposureLevel === 'high' ? 8 : 5;

  return {
    tempShift: Math.round(clamp((homeBaseline.warmTemp - REF_TEMP) * factor, 0, maxTempShift)),
    dewShift: Math.round(clamp((homeBaseline.warmDewpoint - REF_DEW) * factor, 0, maxDewShift)),
  };
};

/**
 * Applies an acclimatization shift to the comfort dials only (hot-side air
 * temperature + dew point). The hard hazard ceiling (`BAD_MAX` / `BAD`) never
 * moves, and shifted thresholds are clamped strictly below it, so a genuinely
 * dangerous day still rates "bad" even for an acclimatized rider. Go/no-go gates
 * (wind, AQI, rain, UV) are returned untouched.
 */
export const applyAcclimatization = (
  base: Thresholds,
  { tempShift, dewShift }: Acclimatization,
): Thresholds => {
  if (!tempShift && !dewShift) return base;

  const t = base.TEMPERATURE;
  const tempCeiling = t.BAD_MAX - 1;
  const d = base.DEWPOINT;
  const dewCeiling = d.BAD - 1;

  return {
    ...base,
    TEMPERATURE: {
      ...t,
      FAIR_MAX: Math.min(t.FAIR_MAX + tempShift, tempCeiling),
      MARGINAL_MAX: Math.min(t.MARGINAL_MAX + tempShift, tempCeiling),
      POOR_MAX: Math.min(t.POOR_MAX + tempShift, tempCeiling),
    },
    DEWPOINT: {
      ...d,
      FAIR: Math.min(d.FAIR + dewShift, dewCeiling),
      MARGINAL: Math.min(d.MARGINAL + dewShift, dewCeiling),
      POOR: Math.min(d.POOR + dewShift, dewCeiling),
    },
  };
};

/**
 * Resolves the thresholds to rate a forecast with, given the rider's home climate.
 */
export const resolveThresholds = (
  homeBaseline: HomeBaseline | null | undefined,
  base: Thresholds = THRESHOLDS,
  exposureLevel: ExposureLevel = DEFAULT_EXPOSURE_LEVEL,
): Thresholds => applyAcclimatization(base, deriveAcclimatization(homeBaseline, exposureLevel));
