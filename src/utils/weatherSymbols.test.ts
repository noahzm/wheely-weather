import { describe, expect, it } from 'vitest';

import { weatherSfSymbol } from './weatherSymbols';

describe('weatherSfSymbol', () => {
  it('falls back to a plain cloud when the code is missing or out of range', () => {
    expect(weatherSfSymbol(null)).toBe('cloud.fill');
    expect(weatherSfSymbol(100)).toBe('cloud.fill');
  });

  it('maps each WMO code band to its symbol', () => {
    expect(weatherSfSymbol(0)).toBe('sun.max.fill');
    expect(weatherSfSymbol(2)).toBe('cloud.sun.fill');
    expect(weatherSfSymbol(45)).toBe('cloud.fog.fill');
    expect(weatherSfSymbol(61)).toBe('cloud.rain.fill');
    expect(weatherSfSymbol(71)).toBe('cloud.snow.fill');
    expect(weatherSfSymbol(80)).toBe('cloud.rain.fill');
    expect(weatherSfSymbol(85)).toBe('cloud.snow.fill');
    expect(weatherSfSymbol(95)).toBe('cloud.bolt.fill');
  });
});
