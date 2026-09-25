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
  const base = {
    homeLocationChosen: false,
    mockScenario: null,
    savedLocation: houston,
    placeName: 'Houston, Texas',
  };

  it('assigns the first loaded place when home was never chosen', () => {
    expect(pickAutoHomeLocation(base)?.name).toBe('Houston, TX');
  });

  it('leaves a chosen or cleared home alone', () => {
    expect(pickAutoHomeLocation({ ...base, homeLocationChosen: true })).toBeNull();
  });

  it('never assigns from a mock preview', () => {
    expect(pickAutoHomeLocation({ ...base, mockScenario: 'ride' })).toBeNull();
  });

  it('needs a real location', () => {
    expect(pickAutoHomeLocation({ ...base, savedLocation: null })).toBeNull();
  });
});
