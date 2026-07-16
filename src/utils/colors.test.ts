import { describe, expect, it } from 'vitest';

import { withAlpha } from './colors';

describe('withAlpha', () => {
  it('converts #rrggbb hex to rgba', () => {
    expect(withAlpha('#FF642C', 0.16)).toBe('rgba(255,100,44,0.16)');
  });

  it('converts #rgb shorthand hex to rgba', () => {
    expect(withAlpha('#fff', 0.5)).toBe('rgba(255,255,255,0.5)');
  });

  it('handles black scrims', () => {
    expect(withAlpha('#161310', 0.15)).toBe('rgba(22,19,16,0.15)');
  });

  it('is case-insensitive', () => {
    expect(withAlpha('#f5f1f6', 1)).toBe(withAlpha('#F5F1F6', 1));
  });

  it('rejects malformed input', () => {
    expect(() => withAlpha('red', 0.5)).toThrow();
    expect(() => withAlpha('#12345', 0.5)).toThrow();
    expect(() => withAlpha('#gggggg', 0.5)).toThrow();
  });
});
