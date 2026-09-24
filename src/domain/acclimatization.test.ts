import { describe, it, expect } from 'vitest';
import {
  deriveAcclimatization,
  applyAcclimatization,
  describeClimateAdjustment,
  resolveThresholds,
} from './acclimatization';
import { THRESHOLDS } from './constants';
import { getOverallStatus, evaluateCondition } from './weather';

const TEMPERATE = { warmTemp: 80, warmDewpoint: 60 };
const PHOENIX = { warmTemp: 105, warmDewpoint: 58 };
const GULF = { warmTemp: 95, warmDewpoint: 78 };
const NORDIC = { warmTemp: 52, warmDewpoint: 42 };

describe('deriveAcclimatization', () => {
  it('returns zero shift for a temperate home or no home', () => {
    expect(deriveAcclimatization(TEMPERATE)).toEqual({ tempShift: 0, dewShift: 0, coldShift: 0 });
    expect(deriveAcclimatization(null)).toEqual({ tempShift: 0, dewShift: 0, coldShift: 0 });
    expect(deriveAcclimatization(NORDIC)).toEqual({ tempShift: 0, dewShift: 0, coldShift: 0 });
  });

  it('returns zero shift when exposureLevel is indoor', () => {
    expect(deriveAcclimatization(PHOENIX, 'indoor')).toEqual({
      tempShift: 0,
      dewShift: 0,
      coldShift: 0,
    });
    expect(deriveAcclimatization(GULF, 'indoor')).toEqual({
      tempShift: 0,
      dewShift: 0,
      coldShift: 0,
    });
  });

  it('shifts heat for a hot-dry home and humidity for a hot-humid home, both capped', () => {
    expect(deriveAcclimatization(PHOENIX, 'moderate')).toEqual({
      tempShift: 4,
      dewShift: 0,
      coldShift: 0,
    });
    expect(deriveAcclimatization(PHOENIX, 'high')).toEqual({
      tempShift: 7,
      dewShift: 0,
      coldShift: 0,
    });
    expect(deriveAcclimatization(GULF, 'moderate')).toEqual({
      tempShift: 4,
      dewShift: 5,
      coldShift: 0,
    });
    expect(deriveAcclimatization(GULF, 'high')).toEqual({
      tempShift: 7,
      dewShift: 8,
      coldShift: 0,
    });
    const AUSTIN = { warmTemp: 88, warmDewpoint: 68 };
    expect(deriveAcclimatization(AUSTIN, 'moderate')).toEqual({
      tempShift: 3,
      dewShift: 3,
      coldShift: 0,
    });
    expect(deriveAcclimatization(AUSTIN, 'high')).toEqual({
      tempShift: 5,
      dewShift: 5,
      coldShift: 0,
    });
  });
});

describe('cold acclimatization', () => {
  // Recent daytime highs: a Chicago December and a mild coastal winter.
  const CHICAGO_WINTER = { ...TEMPERATE, coolTemp: 28 };
  const MILD_WINTER = { ...TEMPERATE, coolTemp: 55 };

  it('shifts the cold side for a cold home, scaled by exposure and capped', () => {
    expect(deriveAcclimatization(CHICAGO_WINTER, 'moderate').coldShift).toBe(6);
    expect(deriveAcclimatization(CHICAGO_WINTER, 'high').coldShift).toBe(12);
    expect(deriveAcclimatization(CHICAGO_WINTER, 'indoor').coldShift).toBe(0);
    expect(deriveAcclimatization({ ...TEMPERATE, coolTemp: 44 }, 'high').coldShift).toBe(4);
  });

  it('never shifts for a mild home or a baseline cached without coolTemp', () => {
    expect(deriveAcclimatization(MILD_WINTER, 'high').coldShift).toBe(0);
    expect(deriveAcclimatization(TEMPERATE, 'high').coldShift).toBe(0);
  });

  it('lowers every cold band, the floor included, and leaves the hot side alone', () => {
    const adjusted = applyAcclimatization(THRESHOLDS, { tempShift: 0, dewShift: 0, coldShift: 12 });
    const t = THRESHOLDS.TEMPERATURE;
    expect(adjusted.TEMPERATURE).toMatchObject({
      BAD_MIN: t.BAD_MIN - 12,
      POOR_MIN: t.POOR_MIN - 12,
      MARGINAL_MIN: t.MARGINAL_MIN - 12,
      FAIR_MIN: t.FAIR_MIN - 12,
      FAIR_MAX: t.FAIR_MAX,
      BAD_MAX: t.BAD_MAX,
    });
  });

  it('lets a cold-adapted rider ride a dry freezing day, but not freezing rain', () => {
    const thresholds = resolveThresholds(CHICAGO_WINTER, THRESHOLDS, 'high');
    const dryFreezing = {
      hasThunderstorms: false,
      temperature: 28,
      feelsLike: 20,
      windSpeed: 6,
      rainChance: 0,
      dewpoint: 15,
      aqi: 20,
    };
    expect(getOverallStatus(dryFreezing)).toBe('no');
    // Bands shift 12°F: rest day below 20°F, iffy 20–28°F, fair from 28°F.
    expect(getOverallStatus(dryFreezing, thresholds)).toBe('yes');
    expect(getOverallStatus({ ...dryFreezing, temperature: 22 }, thresholds)).toBe('maybe');
    expect(getOverallStatus({ ...dryFreezing, temperature: 15 }, thresholds)).toBe('no');
    // Freezing rain (WMO 67) stays a hazard whatever the acclimatization.
    expect(getOverallStatus({ ...dryFreezing, weatherCode: 67 }, thresholds)).toBe('no');
  });
});

describe('applyAcclimatization', () => {
  it('is an identity for a zero shift', () => {
    expect(applyAcclimatization(THRESHOLDS, { tempShift: 0, dewShift: 0, coldShift: 0 })).toBe(
      THRESHOLDS,
    );
  });

  it('raises the comfort dials but never the hard hazard ceiling', () => {
    const adjusted = applyAcclimatization(THRESHOLDS, { tempShift: 6, dewShift: 7, coldShift: 0 });
    // Comfort thresholds move up.
    expect(adjusted.TEMPERATURE.FAIR_MAX).toBe(THRESHOLDS.TEMPERATURE.FAIR_MAX + 6);
    expect(adjusted.DEWPOINT.POOR).toBe(
      Math.min(THRESHOLDS.DEWPOINT.POOR + 7, THRESHOLDS.DEWPOINT.BAD - 1),
    );
    // The avoid line is fixed.
    expect(adjusted.TEMPERATURE.BAD_MAX).toBe(THRESHOLDS.TEMPERATURE.BAD_MAX);
    expect(adjusted.DEWPOINT.BAD).toBe(THRESHOLDS.DEWPOINT.BAD);
    // Gates are untouched.
    expect(adjusted.WIND_SPEED).toEqual(THRESHOLDS.WIND_SPEED);
    expect(adjusted.AQI).toEqual(THRESHOLDS.AQI);
    expect(adjusted.UV_INDEX).toEqual(THRESHOLDS.UV_INDEX);
  });

  it('clamps shifted comfort thresholds strictly below the avoid line', () => {
    const adjusted = applyAcclimatization(THRESHOLDS, {
      tempShift: 50,
      dewShift: 50,
      coldShift: 0,
    });
    expect(adjusted.TEMPERATURE.POOR_MAX).toBeLessThan(THRESHOLDS.TEMPERATURE.BAD_MAX);
    expect(adjusted.DEWPOINT.POOR).toBeLessThan(THRESHOLDS.DEWPOINT.BAD);
  });
});

describe('acclimatization and the verdict', () => {
  const base = {
    hasThunderstorms: false,
    windSpeed: 5,
    rainChance: 0,
    aqi: 20,
    uvIndex: 1,
  };

  it('eases a borderline-hot day for an acclimatized rider', () => {
    const day = { ...base, temperature: 92, dewpoint: 68 };
    // Temperate rider: 92°F air temp is "hard" -> no.
    expect(getOverallStatus(day, THRESHOLDS)).toBe('no');
    // Phoenix-acclimatized rider: eased to a "maybe".
    expect(getOverallStatus(day, resolveThresholds(PHOENIX))).toBe('maybe');
  });

  it('still says no to a genuinely dangerous day even at the home city', () => {
    const dangerous = {
      ...base,
      temperature: 96, // heat-illness range
      dewpoint: 79, // oppressive
    };
    expect(getOverallStatus(dangerous, resolveThresholds(GULF))).toBe('no');
    // Each hazard gate independently survives acclimatization.
    const t = resolveThresholds(GULF);
    expect(evaluateCondition(96, 'temperature', t)).toBe('bad');
    expect(evaluateCondition(79, 'dewpoint', t)).toBe('bad');
    expect(getOverallStatus({ ...base, temperature: 60, hasThunderstorms: true }, t)).toBe('no');
    expect(getOverallStatus({ ...base, temperature: 60, aqi: 250 }, t)).toBe('no');
  });

  it('eases a typically humid Gulf summer day from "no" to "maybe" for an acclimatized rider', () => {
    // Dew 76 is routine on the Gulf Coast summer: merely oppressive, not a
    // hazard. A temperate rider still gets "no" (76 is past the base poor
    // line), but the acclimatized local's shifted bands land it at marginal.
    const day = { ...base, temperature: 84, dewpoint: 76 };
    expect(getOverallStatus(day, THRESHOLDS)).toBe('no');
    expect(getOverallStatus(day, resolveThresholds(GULF))).toBe('maybe');
  });

  it('reproduces the base verdict when there is no home baseline', () => {
    const day = { ...base, temperature: 88, dewpoint: 64 };
    expect(getOverallStatus(day, resolveThresholds(null))).toBe(getOverallStatus(day, THRESHOLDS));
  });
});

describe('describeClimateAdjustment', () => {
  const CHICAGO_WINTER = { warmTemp: 40, warmDewpoint: 30, coolTemp: 25 };

  it('states the standard range without a home or when riding outside rarely', () => {
    expect(describeClimateAdjustment(null, 'high', 'fahrenheit')).toEqual([
      'The standard range applies: ride days run 40–82°F.',
    ]);
    expect(describeClimateAdjustment(GULF, 'indoor', 'fahrenheit')).toEqual([
      'The standard range applies: ride days run 40–82°F.',
    ]);
  });

  it('says so when the home climate is close to the standard', () => {
    expect(describeClimateAdjustment(TEMPERATE, 'high', 'fahrenheit')).toEqual([
      'Your home’s weather is close to the standard, so ride days run 40–82°F.',
    ]);
  });

  it('gives the shifted range against the normal one, and humidity when it moved', () => {
    const shift = deriveAcclimatization(GULF, 'high');
    const lines = describeClimateAdjustment(GULF, 'high', 'fahrenheit');
    expect(lines[0]).toBe(`Ride days run 40–${82 + shift.tempShift}°F for you (normally 40–82°F).`);
    expect(lines[1]).toBe(
      `Humid days stay rideable up to a ${66 + shift.dewShift}°F dew point (normally 66°F).`,
    );
  });

  it('lowers the cold end for a cold home, and speaks the rider’s unit', () => {
    const { coldShift } = deriveAcclimatization(CHICAGO_WINTER, 'high');
    expect(coldShift).toBeGreaterThan(0);
    expect(describeClimateAdjustment(CHICAGO_WINTER, 'high', 'fahrenheit')).toEqual([
      `Ride days run ${40 - coldShift}–82°F for you (normally 40–82°F).`,
    ]);
    expect(describeClimateAdjustment(null, 'moderate', 'celsius')).toEqual([
      'The standard range applies: ride days run 4–28°C.',
    ]);
  });
});
