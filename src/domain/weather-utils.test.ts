import { describe, expect, it } from 'vitest';
import {
  getAqiLabel,
  getDewpointLabel,
  getRainTiming,
  getWindArrowRotation,
  isThunderstorm,
} from './weather';

describe('Weather Utilities', () => {
  it('identifies thunderstorms correctly', () => {
    expect(isThunderstorm(95)).toBe(true);
    expect(isThunderstorm(96)).toBe(true);
    expect(isThunderstorm(99)).toBe(true);
    expect(isThunderstorm(3)).toBe(false);
  });

  it('provides correct AQI labels', () => {
    expect(getAqiLabel(25)).toBe('Good');
    expect(getAqiLabel(75)).toBe('Moderate');
    expect(getAqiLabel(125)).toBe('Unhealthy for Sensitive Groups');
  });

  it('provides correct Dewpoint labels', () => {
    expect(getDewpointLabel(45)).toBe('Dry');
    expect(getDewpointLabel(55)).toBe('Comfortable');
    expect(getDewpointLabel(75)).toBe('Oppressive');
  });

  it('rotates wind direction for arrow rotation', () => {
    expect(getWindArrowRotation(0)).toBe(90);
    expect(getWindArrowRotation(90)).toBe(180);
    expect(getWindArrowRotation(225)).toBe(315);
    expect(getWindArrowRotation(null)).toBeNull();
  });
});

describe('Rain Timing Logic', () => {
  it('returns "Clearing up by..." when rain is happening now but stops later', () => {
    const hourly = [
      { hour: 10, rainChance: 50 },
      { hour: 11, rainChance: 10 },
    ];
    expect(getRainTiming(hourly)).toBe('Clears by 11am');
  });

  it('handles midnight wraparound in rain timing', () => {
    const hourly = [
      { hour: 23, rainChance: 50 },
      { hour: 0, rainChance: 10 },
    ];
    expect(getRainTiming(hourly)).toBe('Clears by 12am');
  });

  it('handles rain spanning midnight', () => {
    const hourly = [
      { hour: 23, rainChance: 10 },
      { hour: 0, rainChance: 50 },
      { hour: 1, rainChance: 10 },
    ];
    expect(getRainTiming(hourly)).toBe('Rain 12am–1am');
  });

  it('returns "Rain likely after..." when rain starts later', () => {
    const hourly = [
      { hour: 10, rainChance: 0 },
      { hour: 11, rainChance: 50 },
    ];
    expect(getRainTiming(hourly)).toBe('Rain likely after 11am');
  });

  it('returns "Rain throughout" when it rains the entire window', () => {
    const hourly = [
      { hour: 10, rainChance: 50 },
      { hour: 11, rainChance: 60 },
    ];
    expect(getRainTiming(hourly)).toBe('Rain throughout');
  });

  it('uses the first contiguous shower block instead of merging separated rain periods', () => {
    const hourly = [
      { hour: 10, rainChance: 10 },
      { hour: 11, rainChance: 50 },
      { hour: 12, rainChance: 0 },
      { hour: 13, rainChance: 60 },
      { hour: 14, rainChance: 0 },
    ];

    expect(getRainTiming(hourly)).toBe('Rain 11am–12pm');
  });

  it('does not call rain throughout when the current shower ends before a later second round', () => {
    const hourly = [
      { hour: 10, rainChance: 50 },
      { hour: 11, rainChance: 0 },
      { hour: 12, rainChance: 60 },
    ];

    expect(getRainTiming(hourly)).toBe('Clears by 11am');
  });
});
