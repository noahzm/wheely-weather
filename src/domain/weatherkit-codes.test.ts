import { describe, expect, it } from 'vitest';
import { weatherKitConditionToWmoCode } from './weatherkit-codes';
import { getWeatherCodeCondition, isThunderstorm } from './weather-codes';

describe('weatherKitConditionToWmoCode', () => {
  it('maps thunderstorm-family conditions to WMO codes that trip isThunderstorm', () => {
    for (const condition of [
      'thunderstorms',
      'isolatedThunderstorms',
      'scatteredThunderstorms',
      'strongStorms',
      'hurricane',
      'tropicalStorm',
      'hail',
    ]) {
      expect(isThunderstorm(weatherKitConditionToWmoCode(condition))).toBe(true);
    }
  });

  it('maps icy/freezing conditions to WMO codes rated "bad"', () => {
    for (const condition of ['freezingDrizzle', 'freezingRain', 'sleet', 'wintryMix']) {
      expect(getWeatherCodeCondition(weatherKitConditionToWmoCode(condition))).toBe('bad');
    }
  });

  it('maps clear-sky conditions to WMO codes rated "good"', () => {
    for (const condition of ['clear', 'mostlyClear']) {
      expect(getWeatherCodeCondition(weatherKitConditionToWmoCode(condition))).toBe('good');
    }
  });

  it('falls back temperature-only descriptors to a clear-sky code, not a hazard', () => {
    expect(weatherKitConditionToWmoCode('frigid')).toBe(0);
    expect(weatherKitConditionToWmoCode('hot')).toBe(0);
  });

  it('falls back unrecognized conditions to the clear-sky code instead of throwing', () => {
    expect(weatherKitConditionToWmoCode('somethingNewAppleAdded')).toBe(0);
  });
});
