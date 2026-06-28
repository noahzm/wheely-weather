import { THRESHOLDS } from './constants';

/** @typedef {import('@/types/weather').Weather} Weather */
/**
 * A rider's home-climate baseline: the representative *warm* exposure at home,
 * used to estimate heat/humidity acclimatization.
 * @typedef {{ warmTemp: number; warmDewpoint: number }} HomeBaseline
 */
/** @typedef {{ tempShift: number; dewShift: number }} Acclimatization */

// Warm-exposure anchors for the "default" temperate recreational rider the base
// thresholds encode. A temperate home (summer high ~80°F, dew ~60°F) yields ~zero
// shift; only genuinely hotter/more-humid homes move the comfort dials.
const REF_TEMP = 80;
const REF_DEW = 60;
// Acclimatization is partial, not magic — take half the climate delta...
const DAMP = 0.5;
// ...and cap it so even a desert/tropical home can't relax the dials without limit.
const MAX_TEMP_SHIFT = 6;
const MAX_DEW_SHIFT = 7;

/** @param {number} v @param {number} lo @param {number} hi */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Derives how much warmer/muggier conditions a home-acclimatized rider tolerates,
 * relative to the base (temperate) thresholds. Only positive (warm/humid) shifts —
 * cold and wind are out of scope (the body doesn't acclimatize to them the same way).
 * @param {HomeBaseline | null | undefined} homeBaseline
 * @returns {Acclimatization}
 */
export const deriveAcclimatization = (homeBaseline) => {
  if (!homeBaseline) return { tempShift: 0, dewShift: 0 };
  return {
    tempShift: clamp((homeBaseline.warmTemp - REF_TEMP) * DAMP, 0, MAX_TEMP_SHIFT),
    dewShift: clamp((homeBaseline.warmDewpoint - REF_DEW) * DAMP, 0, MAX_DEW_SHIFT),
  };
};

/**
 * Applies an acclimatization shift to the comfort dials only (hot-side air
 * temperature + dew point). The hard hazard ceiling (`BAD_MAX` / `BAD`) never
 * moves, and shifted thresholds are clamped strictly below it, so a genuinely
 * dangerous day still rates "bad" even for an acclimatized rider. Go/no-go gates
 * (wind, AQI, rain, UV) are returned untouched.
 * @param {typeof THRESHOLDS} base
 * @param {Acclimatization} acclimatization
 * @returns {typeof THRESHOLDS}
 */
export const applyAcclimatization = (base, { tempShift, dewShift }) => {
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
 * @param {HomeBaseline | null | undefined} homeBaseline
 * @param {typeof THRESHOLDS} [base]
 * @returns {typeof THRESHOLDS}
 */
export const resolveThresholds = (homeBaseline, base = THRESHOLDS) =>
  applyAcclimatization(base, deriveAcclimatization(homeBaseline));

/**
 * A short, honest relative-context note: how today's heat/humidity compares to
 * what the rider is used to at home. Keeps the absolute verdict honest while
 * adding the personal read. Returns null when there's nothing useful to say.
 * @param {Pick<Weather, 'temperature' | 'dewpoint'>} weather
 * @param {HomeBaseline | null | undefined} homeBaseline
 * @returns {string | null}
 */
export const getAcclimatizationNote = (weather, homeBaseline) => {
  if (!homeBaseline || weather?.temperature == null) return null;
  const { tempShift, dewShift } = deriveAcclimatization(homeBaseline);
  const acclimatized = tempShift > 0 || dewShift > 0;

  const tempDelta = weather.temperature - homeBaseline.warmTemp;
  const dewDelta = (weather.dewpoint ?? weather.temperature) - homeBaseline.warmDewpoint;
  const hotter = Math.max(tempDelta, dewDelta);

  if (hotter >= 6) return 'Tougher than you’re used to at home';
  if (acclimatized && hotter >= -6) return 'About normal for your home climate';
  if (hotter <= -18) return 'Mild compared to home';
  return null;
};
