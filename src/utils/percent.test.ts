import { describe, expect, it } from 'vitest';

import { formatPercent, normalizePercent } from './percent';

describe('normalizePercent', () => {
  it('rounds floating point precision artifacts to whole percentages', () => {
    expect(normalizePercent(56 + 1e-14)).toBe(56);
    expect(normalizePercent(12.6)).toBe(13);
  });

  it('clamps values to a valid percentage range', () => {
    expect(normalizePercent(-4.1)).toBe(0);
    expect(normalizePercent(104.9)).toBe(100);
  });
});

describe('formatPercent', () => {
  it('returns a rounded whole-percent string', () => {
    expect(formatPercent(56 + 1e-14)).toBe('56%');
  });
});
