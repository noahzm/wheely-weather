import { describe, expect, it } from 'vitest';

import { cityFromLocation } from './locationTitle';

describe('cityFromLocation', () => {
  it('takes the first component of a comma-separated label', () => {
    expect(cityFromLocation('Toronto, Ontario, Canada')).toBe('Toronto');
  });

  it('trims surrounding whitespace', () => {
    expect(cityFromLocation('  Hamilton , Ontario')).toBe('Hamilton');
  });

  it('passes through a label with no separator', () => {
    expect(cityFromLocation('Reykjavík')).toBe('Reykjavík');
  });

  it('returns an empty string for missing or blank labels', () => {
    const missing: string | undefined = undefined;
    expect(cityFromLocation(null)).toBe('');
    expect(cityFromLocation(missing)).toBe('');
    expect(cityFromLocation('   ')).toBe('');
  });
});
