import { describe, expect, it } from 'vitest';

import { fahrenheitToCelsius, formatTemperature } from './temperature';

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
