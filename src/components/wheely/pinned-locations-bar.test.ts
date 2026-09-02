import { describe, expect, it } from 'vitest';
import { resolveLocationChipName } from '@/utils/locationTitle';
import { sameCoords } from '@/utils/locationRows';
import type { RecentLocation, SavedLocation } from '@/services/locationStorage';

describe('PinnedLocationsBar helpers', () => {
  const pins: RecentLocation[] = [
    { label: 'Boulder, CO', displayName: 'United States', lat: 40.015, lon: -105.27 },
    { label: 'Girona', displayName: 'Catalonia, Spain', lat: 41.979, lon: 2.821 },
  ];

  it('formats locations into concise pill labels prioritizing city label', () => {
    expect(resolveLocationChipName(pins[0])).toBe('Boulder');
    expect(resolveLocationChipName(pins[1])).toBe('Girona');
  });

  it('correctly matches active location using coordinate identity', () => {
    const activeSaved: SavedLocation = {
      displayName: 'Boulder, CO',
      lat: 40.015,
      lon: -105.27,
    };
    expect(sameCoords(pins[0], activeSaved)).toBe(true);
    expect(sameCoords(pins[1], activeSaved)).toBe(false);
  });
});
