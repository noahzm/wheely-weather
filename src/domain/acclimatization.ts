import { DEFAULT_EXPOSURE_LEVEL, type ExposureLevel } from '@/types/settings';
import type { HomeBaseline } from '@/types/weather';
import { THRESHOLDS, type Thresholds } from './constants';

interface Acclimatization {
  tempShift: number;
  dewShift: number;
  /** How many °F lower the cold-side bands sit (always >= 0). */
  coldShift: number;
}

// Warm-exposure anchors for the "default" temperate recreational rider the base
// thresholds encode. A temperate home (summer high ~80°F, dew ~60°F) yields ~zero
// shift; only genuinely hotter/more-humid homes move the comfort dials.
const REF_TEMP = 80;
const REF_DEW = 60;
// Cold-side anchor: recent daytime highs around 50°F (a temperate shoulder
// season) yield no shift; only genuinely cold homes move the cold dials.
const REF_COOL = 50;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Derives how much warmer, muggier and colder conditions a home-acclimatized
 * rider tolerates, relative to the base (temperate) thresholds. Riders who have
 * been out in a hot, humid or cold home climate lately are adapted to it, in
 * body and in kit; the exposure level scales how much. Wind is out of scope.
 */
export const deriveAcclimatization = (
  homeBaseline: HomeBaseline | null | undefined,
  exposureLevel: ExposureLevel = DEFAULT_EXPOSURE_LEVEL,
): Acclimatization => {
  if (!homeBaseline || exposureLevel === 'indoor') {
    return { tempShift: 0, dewShift: 0, coldShift: 0 };
  }
  const factor = exposureLevel === 'high' ? 0.65 : 0.35;
  const maxTempShift = exposureLevel === 'high' ? 7 : 4;
  const maxDewShift = exposureLevel === 'high' ? 8 : 5;
  // Larger than the heat cap: kit does most of the cold adapting, and a
  // winter-hardened rider in full kit rides 20°F below the reference floor.
  const maxColdShift = exposureLevel === 'high' ? 12 : 6;
  const { coolTemp } = homeBaseline;

  return {
    tempShift: Math.round(clamp((homeBaseline.warmTemp - REF_TEMP) * factor, 0, maxTempShift)),
    dewShift: Math.round(clamp((homeBaseline.warmDewpoint - REF_DEW) * factor, 0, maxDewShift)),
    coldShift:
      coolTemp == null ? 0 : Math.round(clamp((REF_COOL - coolTemp) * factor, 0, maxColdShift)),
  };
};

/**
 * Applies an acclimatization shift to the comfort dials only (hot-side air
 * temperature + dew point). The hard hazard ceiling (`BAD_MAX` / `BAD`) never
 * moves, and shifted thresholds are clamped strictly below it, so a genuinely
 * dangerous day still rates "bad" even for an acclimatized rider. Go/no-go gates
 * (wind, AQI, rain, UV) are returned untouched.
 *
 * The cold side shifts down as a whole, `BAD_MIN` included: the reference's
 * 32°F floor is a comfort line, not a hazard, since ice is rated separately by
 * the freezing-precipitation weather codes and the cold-rain hazard, which stay
 * fixed. The cap in `deriveAcclimatization` bounds how far it can go.
 */
export const applyAcclimatization = (
  base: Thresholds,
  { tempShift, dewShift, coldShift }: Acclimatization,
): Thresholds => {
  if (!tempShift && !dewShift && !coldShift) return base;

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
      BAD_MIN: t.BAD_MIN - coldShift,
      POOR_MIN: t.POOR_MIN - coldShift,
      MARGINAL_MIN: t.MARGINAL_MIN - coldShift,
      FAIR_MIN: t.FAIR_MIN - coldShift,
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
 * Resolves the thresholds to rate a forecast with, given the rider's home climate
 * baseline and outdoor exposure preference level.
 *
 * @param homeBaseline - 30-day warm baseline for the user's home location
 * @param base - Base thresholds to adjust (defaults to THRESHOLDS)
 * @param exposureLevel - Exposure level setting (defaults to DEFAULT_EXPOSURE_LEVEL)
 * @returns Acclimatized weather rating thresholds
 */
export const resolveThresholds = (
  homeBaseline: HomeBaseline | null | undefined,
  base: Thresholds = THRESHOLDS,
  exposureLevel: ExposureLevel = DEFAULT_EXPOSURE_LEVEL,
): Thresholds => applyAcclimatization(base, deriveAcclimatization(homeBaseline, exposureLevel));
