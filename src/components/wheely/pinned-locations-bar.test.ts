import { describe, expect, it } from 'vitest';
import { resolveLocationChipName } from '@/utils/locationTitle';
import { sameCoords } from '@/utils/locationRows';
import type { RecentLocation, SavedLocation } from '@/services/locationStorage';

describe('PinnedLocationsBar helpers', () => {
  const boulder: RecentLocation = {
    label: 'Boulder, CO',
    displayName: 'United States',
    lat: 40.015,
    lon: -105.27,
  };
  const girona: RecentLocation = {
    label: 'Girona',
    displayName: 'Catalonia, Spain',
    lat: 41.979,
    lon: 2.821,
  };

  it('formats locations into concise pill labels prioritizing city label', () => {
    expect(resolveLocationChipName(boulder)).toBe('Boulder');
    expect(resolveLocationChipName(girona)).toBe('Girona');
  });

  it('correctly matches active location using coordinate identity', () => {
    const activeSaved: SavedLocation = {
      name: 'Boulder, CO',
      lat: 40.015,
      lon: -105.27,
      source: 'manual',
    };
    expect(sameCoords(boulder, activeSaved)).toBe(true);
    expect(sameCoords(girona, activeSaved)).toBe(false);
  });
});
