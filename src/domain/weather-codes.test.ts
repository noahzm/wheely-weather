import { describe, expect, it } from 'vitest';
import {
  getWeatherCodeCondition,
  getWeatherCodeIssue,
  getWeatherDescription,
  isThunderstorm,
} from './weather-codes';

describe('Weather Code Conditions', () => {
  it('rates ice/freezing codes as bad (avoid)', () => {
    for (const code of [48, 56, 57, 66, 67]) {
      expect(getWeatherCodeCondition(code)).toBe('bad');
    }
  });

  it('rates thunderstorm codes as bad', () => {
    for (const code of [95, 96, 99]) {
      expect(isThunderstorm(code)).toBe(true);
      expect(getWeatherCodeCondition(code)).toBe('bad');
    }
    expect(isThunderstorm(0)).toBe(false);
    expect(isThunderstorm(null)).toBe(false);
  });

  it('keeps light rain workable and heavy rain hard, per the reference surface table', () => {
    expect(getWeatherCodeCondition(61)).toBe('fair'); // light rain -> good zone
    expect(getWeatherCodeCondition(65)).toBe('poor'); // heavy rain -> hard
    expect(getWeatherCodeCondition(0)).toBe('good'); // dry
    expect(getWeatherCodeCondition(null)).toBe('good');
  });

  it('describes weather codes or returns Unknown for null or unrecognized codes', () => {
    expect(getWeatherDescription(0)).toBe('Clear skies');
    expect(getWeatherDescription(63)).toBe('Rain');
    expect(getWeatherDescription(null)).toBe('Unknown');
    expect(getWeatherDescription(9999)).toBe('Unknown');
  });

  it('extracts ride-limiting issues from weather codes based on status', () => {
    expect(getWeatherCodeIssue(65, 'no')).toBe('heavy rain');
    expect(getWeatherCodeIssue(51, 'maybe')).toBe('light drizzle');
    expect(getWeatherCodeIssue(0, 'no')).toBeNull();
    expect(getWeatherCodeIssue(null, 'no')).toBeNull();
    expect(getWeatherCodeIssue(95, 'no')).toBeNull(); // 95 is thunderstorm, rated bad, but has no issue phrase in table
  });
});
