import { describe, expect, it } from 'vitest';
import { getWeatherCodeCondition } from './weather';

describe('Weather Code Conditions', () => {
  it('rates ice/freezing codes as bad (avoid)', () => {
    for (const code of [48, 56, 57, 66, 67]) {
      expect(getWeatherCodeCondition(code)).toBe('bad');
    }
  });

  it('keeps light rain workable and heavy rain hard, per the reference surface table', () => {
    expect(getWeatherCodeCondition(61)).toBe('fair'); // light rain -> good zone
    expect(getWeatherCodeCondition(65)).toBe('poor'); // heavy rain -> hard
    expect(getWeatherCodeCondition(0)).toBe('good'); // dry
  });
});
