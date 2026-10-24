import { describe, expect, it } from 'vitest';
import {
  getSky,
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

  it('rates snow a step worse than rain of the same intensity', () => {
    expect(getWeatherCodeCondition(63)).toBe('marginal'); // moderate rain
    expect(getWeatherCodeCondition(73)).toBe('poor'); // moderate snow settles on the road
    expect(getWeatherCodeCondition(71)).toBe('marginal'); // light snow
    expect(getWeatherCodeCondition(77)).toBe('marginal'); // snow grains, as light as light snow
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

describe('getSky', () => {
  const skies = (codes: number[]) => codes.map((code) => getSky(code));

  it('shows the sun for clear and mostly clear skies', () => {
    expect(skies([0, 1])).toEqual(['clear', 'clear']);
  });

  it('half hides the sun when partly cloudy', () => {
    expect(getSky(2)).toBe('partly');
  });

  it('keeps overcast dry', () => {
    expect(getSky(3)).toBe('overcast');
  });

  it('mists over for fog and freezing fog', () => {
    expect(skies([45, 48])).toEqual(['fog', 'fog']);
  });

  it('drizzles lightly for drizzle', () => {
    expect(skies([51, 53, 55])).toEqual(['drizzle', 'drizzle', 'drizzle']);
  });

  it('rains for rain and showers', () => {
    for (const code of [61, 63, 65, 80, 81, 82]) expect(getSky(code)).toBe('rain');
  });

  it('mixes sleet for freezing drizzle and freezing rain', () => {
    expect(skies([56, 57, 66, 67])).toEqual(['sleet', 'sleet', 'sleet', 'sleet']);
  });

  it('snows for snow, snow grains and snow showers', () => {
    for (const code of [71, 73, 75, 77, 85, 86]) expect(getSky(code)).toBe('snow');
  });

  it('storms for thunderstorms, with or without hail', () => {
    expect(skies([95, 96, 99])).toEqual(['storm', 'storm', 'storm']);
  });

  it('returns null without a known code', () => {
    expect(getSky(null)).toBeNull();
    expect(getSky(10)).toBeNull();
  });
});
