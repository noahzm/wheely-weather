import { DEFAULT_EXPOSURE_LEVEL, type ExposureLevel } from '@/types/settings';
import type { HomeBaseline } from '@/types/weather';
import { THRESHOLDS, type Thresholds } from './constants';
import { CLIMATE_MESSAGES as MSG } from './copy';

import { fahrenheitToCelsius, formatTemperature, type TempUnit } from '../utils/temperature';

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
  // Humidity adapts further than heat. A 2025 replay of Gulf Coast summers,
  // when a typical morning dew point is ~75°F, rated every day "maybe" under
  // the old 0.35 / 5°F dials, leaving the verdict nothing to tell apart. These
  // put a local-normal summer morning at "fair"; 78°F+ stays a hazard (BAD).
  const dewFactor = exposureLevel === 'high' ? 0.8 : 0.6;
  const maxDewShift = exposureLevel === 'high' ? 12 : 9;
  // Larger than the heat cap: kit does most of the cold adapting, and a
  // winter-hardened rider in full kit rides 20°F below the reference floor.
  // Ice is rated separately (weather codes, cold rain), so these only move
  // comfort lines.
  const maxColdShift = exposureLevel === 'high' ? 18 : 10;
  const { coolTemp } = homeBaseline;

  return {
    tempShift: Math.round(clamp((homeBaseline.warmTemp - REF_TEMP) * factor, 0, maxTempShift)),
    dewShift: Math.round(clamp((homeBaseline.warmDewpoint - REF_DEW) * dewFactor, 0, maxDewShift)),
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
 * fixed. The cap in `deriveAcclimatization` bounds how far it can go. A cold
 * shift also softens mild cold rain (above SEVERE_TEMP) from poor to marginal;
 * cold rain at or below SEVERE_TEMP stays bad.
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
    // Cold-adapted riders take the mild cold-rain band as marginal, not poor.
    COLD_RAIN: coldShift > 0 ? { MILD: 'marginal' } : base.COLD_RAIN,
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

/** "40–82°F": the low end without a unit, so the range reads as one span. */
const formatRange = (low: number, high: number, unit: TempUnit): string => {
  const lowValue = unit === 'celsius' ? fahrenheitToCelsius(low) : low;
  return `${Math.round(lowValue)}–${formatTemperature(high, unit, { withUnitLabel: true })}`;
};

/** The temperatures that still rate a ride day (fair or better) under `t`. */
const rideRange = (t: Thresholds, unit: TempUnit): string =>
  formatRange(t.TEMPERATURE.MARGINAL_MIN, t.TEMPERATURE.MARGINAL_MAX, unit);

/**
 * What the home climate setting does, in plain numbers, for the settings
 * screen: the ride-day temperature range it produces against the standard one,
 * plus a humidity line when that moved too. When the home's climate applies,
 * a last line says it comes from the home's last 30 days, which is why the
 * numbers move with the seasons. One sentence per entry.
 */
export const describeClimateAdjustment = (
  homeBaseline: HomeBaseline | null | undefined,
  exposureLevel: ExposureLevel,
  unit: TempUnit,
  homeLabel?: string | null,
): string[] => {
  const standard = rideRange(THRESHOLDS, unit);
  if (!homeBaseline || exposureLevel === 'indoor') return [MSG.STANDARD(standard)];
  const basis = homeLabel ? [MSG.BASIS(homeLabel)] : [];

  const shift = deriveAcclimatization(homeBaseline, exposureLevel);
  if (!shift.tempShift && !shift.coldShift && !shift.dewShift) {
    return [MSG.NO_SHIFT(standard), ...basis];
  }

  const adjusted = applyAcclimatization(THRESHOLDS, shift);
  const lines = [MSG.SHIFTED(rideRange(adjusted, unit), standard)];
  if (shift.dewShift) {
    const dew = (t: Thresholds) =>
      formatTemperature(t.DEWPOINT.MARGINAL, unit, { withUnitLabel: true });
    lines.push(MSG.HUMIDITY(dew(adjusted), dew(THRESHOLDS)));
  }
  return [...lines, ...basis];
};
