import { describe, expect, it } from 'vitest';

import { cityFromLocation, resolveLocationChipName } from './locationTitle';

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

describe('resolveLocationChipName', () => {
  it('prefers city from label when available (e.g. MapKit format)', () => {
    expect(
      resolveLocationChipName({
        label: 'Raleigh, NC',
        displayName: 'United States',
      }),
    ).toBe('Raleigh');
  });

  it('falls back to displayName when label is absent (e.g. Nominatim format)', () => {
    expect(
      resolveLocationChipName({
        label: '',
        displayName: 'Boulder, CO, United States',
      }),
    ).toBe('Boulder');
  });

  it('handles raw city names without separators', () => {
    expect(
      resolveLocationChipName({
        label: 'Girona',
        displayName: 'Spain',
      }),
    ).toBe('Girona');
  });

  it('falls back to Location when both are empty', () => {
    expect(resolveLocationChipName({})).toBe('Location');
  });
});
