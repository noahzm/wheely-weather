import { describe, it, expect } from 'vitest';
import {
  deriveAcclimatization,
  applyAcclimatization,
  resolveThresholds,
  getAcclimatizationNote,
} from './acclimatization';
import { THRESHOLDS } from './constants';
import { getOverallStatus, evaluateCondition } from './weather';

const TEMPERATE = { warmTemp: 80, warmDewpoint: 60 };
const PHOENIX = { warmTemp: 105, warmDewpoint: 58 };
const GULF = { warmTemp: 95, warmDewpoint: 78 };
const NORDIC = { warmTemp: 52, warmDewpoint: 42 };

describe('deriveAcclimatization', () => {
  it('returns zero shift for a temperate home or no home', () => {
    expect(deriveAcclimatization(TEMPERATE)).toEqual({ tempShift: 0, dewShift: 0 });
    expect(deriveAcclimatization(null)).toEqual({ tempShift: 0, dewShift: 0 });
    expect(deriveAcclimatization(NORDIC)).toEqual({ tempShift: 0, dewShift: 0 });
  });

  it('shifts heat for a hot-dry home and humidity for a hot-humid home, both capped', () => {
    expect(deriveAcclimatization(PHOENIX)).toEqual({ tempShift: 6, dewShift: 0 });
    expect(deriveAcclimatization(GULF)).toEqual({ tempShift: 6, dewShift: 7 });
  });
});

describe('applyAcclimatization', () => {
  it('is an identity for a zero shift', () => {
    expect(applyAcclimatization(THRESHOLDS, { tempShift: 0, dewShift: 0 })).toBe(THRESHOLDS);
  });

  it('raises the comfort dials but never the hard hazard ceiling', () => {
    const adjusted = applyAcclimatization(THRESHOLDS, { tempShift: 6, dewShift: 7 });
    // Comfort thresholds move up.
    expect(adjusted.TEMPERATURE.FAIR_MAX).toBe(THRESHOLDS.TEMPERATURE.FAIR_MAX + 6);
    expect(adjusted.DEWPOINT.POOR).toBe(THRESHOLDS.DEWPOINT.POOR + 7);
    // The avoid line is fixed.
    expect(adjusted.TEMPERATURE.BAD_MAX).toBe(THRESHOLDS.TEMPERATURE.BAD_MAX);
    expect(adjusted.DEWPOINT.BAD).toBe(THRESHOLDS.DEWPOINT.BAD);
    // Gates are untouched.
    expect(adjusted.WIND_SPEED).toEqual(THRESHOLDS.WIND_SPEED);
    expect(adjusted.AQI).toEqual(THRESHOLDS.AQI);
    expect(adjusted.UV_INDEX).toEqual(THRESHOLDS.UV_INDEX);
  });

  it('clamps shifted comfort thresholds strictly below the avoid line', () => {
    const adjusted = applyAcclimatization(THRESHOLDS, { tempShift: 50, dewShift: 50 });
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
    const day = { ...base, temperature: 88, dewpoint: 64 };
    // Temperate rider: 88°F air temp is "hard" -> no.
    expect(getOverallStatus(day, THRESHOLDS)).toBe('no');
    // Phoenix-acclimatized rider: eased to a "maybe".
    expect(getOverallStatus(day, resolveThresholds(PHOENIX))).toBe('maybe');
  });

  it('still says no to a genuinely dangerous day even at the home city', () => {
    const dangerous = {
      ...base,
      temperature: 96, // heat-illness range
      dewpoint: 76, // oppressive
    };
    expect(getOverallStatus(dangerous, resolveThresholds(GULF))).toBe('no');
    // Each hazard gate independently survives acclimatization.
    const t = resolveThresholds(GULF);
    expect(evaluateCondition(96, 'temperature', t)).toBe('bad');
    expect(evaluateCondition(76, 'dewpoint', t)).toBe('bad');
    expect(getOverallStatus({ ...base, temperature: 60, hasThunderstorms: true }, t)).toBe('no');
    expect(getOverallStatus({ ...base, temperature: 60, aqi: 250 }, t)).toBe('no');
  });

  it('reproduces the base verdict when there is no home baseline', () => {
    const day = { ...base, temperature: 88, dewpoint: 64 };
    expect(getOverallStatus(day, resolveThresholds(null))).toBe(getOverallStatus(day, THRESHOLDS));
  });
});

describe('getAcclimatizationNote', () => {
  it('flags a day tougher than home', () => {
    expect(getAcclimatizationNote({ temperature: 92, dewpoint: 60 }, TEMPERATE)).toBe(
      'Tougher than you’re used to at home',
    );
  });

  it('reassures an acclimatized rider on a normal-for-home day', () => {
    expect(getAcclimatizationNote({ temperature: 100, dewpoint: 58 }, PHOENIX)).toBe(
      'About normal for your home climate',
    );
  });

  it('returns null without a home baseline', () => {
    expect(getAcclimatizationNote({ temperature: 90, dewpoint: 60 }, null)).toBeNull();
  });
});
