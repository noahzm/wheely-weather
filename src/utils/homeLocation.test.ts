import { describe, expect, it } from 'vitest';

import type { SavedLocation } from '@/services/settingsCodec';

import { pickAutoHomeLocation, toHomeLocation } from './homeLocation';

const houston: SavedLocation = { lat: 29.76, lon: -95.37, name: null, source: 'device' };

describe('toHomeLocation', () => {
  it('labels home with the place name, abbreviating a trailing US state', () => {
    expect(toHomeLocation(houston, 'Houston, Texas')).toEqual({
      lat: 29.76,
      lon: -95.37,
      name: 'Houston, TX',
      source: 'device',
    });
  });

  it("falls back to the location's own name, then to none", () => {
    expect(toHomeLocation({ ...houston, name: 'Home' }).name).toBe('Home');
    expect(toHomeLocation(houston, '').name).toBeNull();
  });
});

describe('pickAutoHomeLocation', () => {
  const searched: SavedLocation = { lat: 39.74, lon: -104.99, name: 'Denver', source: 'manual' };
  const base = {
    homeLocation: null,
    homeLocationChosen: false,
    homeLocationAuto: false,
    mockScenario: null,
    savedLocation: houston,
    placeName: 'Houston, Texas',
  };

  it('assigns the first loaded place when home was never chosen', () => {
    expect(pickAutoHomeLocation(base)?.name).toBe('Houston, TX');
  });

  it('leaves a chosen or cleared home alone', () => {
    expect(
      pickAutoHomeLocation({ ...base, homeLocation: searched, homeLocationChosen: true }),
    ).toBeNull();
    expect(pickAutoHomeLocation({ ...base, homeLocationChosen: true })).toBeNull();
  });

  it('replaces a provisional home from a search with the first GPS fix', () => {
    const provisional = {
      ...base,
      homeLocation: searched,
      homeLocationChosen: true,
      homeLocationAuto: true,
    };
    expect(pickAutoHomeLocation(provisional)?.name).toBe('Houston, TX');
    // Another search doesn't move it; only a device fix is a better guess.
    expect(
      pickAutoHomeLocation({ ...provisional, savedLocation: { ...houston, source: 'manual' } }),
    ).toBeNull();
  });

  it('keeps a provisional home that already came from GPS', () => {
    expect(
      pickAutoHomeLocation({
        ...base,
        homeLocation: houston,
        homeLocationChosen: true,
        homeLocationAuto: true,
        savedLocation: { ...houston, lat: 30.27, lon: -97.74 },
      }),
    ).toBeNull();
  });

  it('never assigns from a mock preview', () => {
    expect(pickAutoHomeLocation({ ...base, mockScenario: 'ride' })).toBeNull();
  });

  it('needs a real location', () => {
    expect(pickAutoHomeLocation({ ...base, savedLocation: null })).toBeNull();
  });
});
