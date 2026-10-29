import { describe, expect, it } from 'vitest';

import {
  cityFromLocation,
  formatPlaceLabel,
  resolveHomeCity,
  resolveLocationChipName,
} from './locationTitle';

describe('resolveHomeCity', () => {
  it('prefers the saved location name in live mode and the mock label in mock mode', () => {
    expect(resolveHomeCity('Durham, NC', 'Mock: Wait For It', false)).toBe('Durham');
    expect(resolveHomeCity('Durham, NC', 'Mock: Wait For It', true)).toBe('Mock: Wait For It');
    expect(resolveHomeCity(null, 'Raleigh, NC')).toBe('Raleigh');
  });
});

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

describe('formatPlaceLabel', () => {
  it('abbreviates US states, whatever case the country code is in', () => {
    expect(formatPlaceLabel({ city: 'Raleigh', region: 'North Carolina', countryCode: 'us' })).toBe(
      'Raleigh, NC',
    );
    expect(formatPlaceLabel({ city: 'Cary', region: 'North Carolina', countryCode: 'US' })).toBe(
      'Cary, NC',
    );
  });

  it('keeps a region that is already abbreviated', () => {
    expect(formatPlaceLabel({ city: 'Durham', region: 'NC', countryCode: 'US' })).toBe(
      'Durham, NC',
    );
  });

  it('leaves regions outside the US alone', () => {
    expect(formatPlaceLabel({ city: 'Toronto', region: 'Ontario', countryCode: 'CA' })).toBe(
      'Toronto, Ontario',
    );
    expect(formatPlaceLabel({ city: 'Georgia', region: 'Georgia', countryCode: null })).toBe(
      'Georgia, Georgia',
    );
  });

  it('falls back to the city alone, then to "Your Location"', () => {
    expect(formatPlaceLabel({ city: 'Monaco', region: null })).toBe('Monaco');
    expect(formatPlaceLabel({ city: null, region: 'Nunavut', countryCode: 'CA' })).toBe(
      'Your Location',
    );
    expect(formatPlaceLabel({})).toBe('Your Location');
  });
});
