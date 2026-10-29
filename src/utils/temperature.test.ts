import { describe, expect, it } from 'vitest';

import {
  fahrenheitToCelsius,
  formatTemperature,
  formatTemperatureRange,
  formatWindSpeed,
  mphToKmh,
} from './temperature';

describe('fahrenheitToCelsius', () => {
  it('converts freezing and boiling points', () => {
    expect(fahrenheitToCelsius(32)).toBe(0);
    expect(fahrenheitToCelsius(212)).toBe(100);
  });

  it('handles negative temperatures', () => {
    expect(fahrenheitToCelsius(-40)).toBe(-40);
  });
});

describe('formatTemperature', () => {
  it('passes fahrenheit through with a bare degree sign', () => {
    expect(formatTemperature(64.4, 'fahrenheit')).toBe('64°');
  });

  it('converts to celsius and rounds', () => {
    expect(formatTemperature(64, 'celsius')).toBe('18°');
    expect(formatTemperature(32, 'celsius')).toBe('0°');
  });

  it('appends the unit label when requested', () => {
    expect(formatTemperature(95, 'fahrenheit', { withUnitLabel: true })).toBe('95°F');
    expect(formatTemperature(95, 'celsius', { withUnitLabel: true })).toBe('35°C');
  });
});

describe('formatTemperatureRange', () => {
  it('formats distinct low and high temperatures with an en-dash', () => {
    expect(formatTemperatureRange(58, 65, 'fahrenheit')).toBe('58°–65°');
    expect(formatTemperatureRange(59, 68, 'celsius')).toBe('15°–20°');
  });

  it('collapses to a single value when both endpoints round to the same degree', () => {
    expect(formatTemperatureRange(71, 71, 'fahrenheit')).toBe('71°');
    expect(formatTemperatureRange(70.8, 71.4, 'celsius')).toBe('22°');
  });
});

describe('mphToKmh and formatWindSpeed', () => {
  it('converts mph to km/h', () => {
    expect(mphToKmh(0)).toBe(0);
    expect(Math.round(mphToKmh(10))).toBe(16);
    expect(Math.round(mphToKmh(20))).toBe(32);
  });

  it('formats wind speed as mph for fahrenheit and km/h for celsius', () => {
    expect(formatWindSpeed(15.4)).toBe('15 mph');
    expect(formatWindSpeed(15.4, 'fahrenheit')).toBe('15 mph');
    expect(formatWindSpeed(15, 'celsius')).toBe('24 km/h');
  });
});
