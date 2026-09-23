import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS } from './settingsCodec';
import {
  addPinnedLocation,
  clearHomeLocation,
  loadAllSettings,
  loadPinnedLocations,
  loadRecentLocations,
  loadSavedLocation,
  normalizeRecentLocation,
  removePinnedLocation,
  saveAppearance,
  saveExposureLevel,
  saveGearMode,
  saveHomeLocation,
  saveLocation,
  saveRecentLocation,
  saveTempUnit,
  type RecentLocation,
} from './locationStorage';

const { store, storage, captureError } = vi.hoisted(() => {
  const store = new Map<string, string>();
  const storage = {
    getItem: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
    multiGet: vi.fn((keys: string[]) =>
      Promise.resolve(keys.map((key) => [key, store.get(key) ?? null] as const)),
    ),
  };
  return { store, storage, captureError: vi.fn() };
});

vi.mock('@react-native-async-storage/async-storage', () => ({ default: storage }));
vi.mock('./telemetry', () => ({ captureError }));

const place = (lat: number, label = `Place ${String(lat)}`): RecentLocation => ({
  lat,
  lon: -100,
  label,
  displayName: '',
});

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

describe('saved location', () => {
  it('reads null when nothing is stored', async () => {
    await expect(loadSavedLocation()).resolves.toBeNull();
  });

  it('round-trips a normalized location with a version tag', async () => {
    await saveLocation({ lat: 45.5, lon: -122.6, name: '  Portland  ', source: 'manual' });

    expect(JSON.parse(store.get('ww_location') ?? '')).toMatchObject({ version: 1 });
    await expect(loadSavedLocation()).resolves.toEqual({
      lat: 45.5,
      lon: -122.6,
      name: 'Portland',
      source: 'manual',
    });
  });

  it('rejects an invalid location instead of persisting it', async () => {
    await expect(saveLocation({ lat: 200, lon: 0, name: null, source: 'manual' })).rejects.toThrow(
      'Invalid location',
    );
    expect(store.has('ww_location')).toBe(false);
  });

  // Swallowing a read failure into null would look like "no location saved"
  // and latch the location prompt, so corrupt data must surface as an error.
  it('propagates corrupt JSON rather than reading it as no location', async () => {
    store.set('ww_location', '{not json');
    await expect(loadSavedLocation()).rejects.toThrow();
  });
});

describe('home location', () => {
  it('saves and clears', async () => {
    await saveHomeLocation({ lat: 35.78, lon: -78.64, name: 'Raleigh', source: 'manual' });
    expect(store.has('ww_home_location')).toBe(true);
    await clearHomeLocation();
    expect(store.has('ww_home_location')).toBe(false);
  });

  it('rejects an invalid location', async () => {
    await expect(
      saveHomeLocation({ lat: Number.NaN, lon: 0, name: null, source: 'manual' }),
    ).rejects.toThrow('Invalid location');
  });
});

describe('normalizeRecentLocation', () => {
  it('rejects non-objects, bad coordinates, and blank labels', () => {
    expect(normalizeRecentLocation(null)).toBeNull();
    expect(normalizeRecentLocation('Portland')).toBeNull();
    expect(normalizeRecentLocation({ lat: 'x', lon: 1, label: 'A' })).toBeNull();
    expect(normalizeRecentLocation({ lat: 1, lon: 1, label: '   ' })).toBeNull();
    expect(normalizeRecentLocation({ lat: 1, lon: 1, label: 7 })).toBeNull();
  });

  it('coerces numeric strings, trims, and caps label lengths', () => {
    expect(
      normalizeRecentLocation({ lat: '1.5', lon: '2', label: `  ${'a'.repeat(120)}  ` }),
    ).toEqual({ lat: 1.5, lon: 2, label: 'a'.repeat(96), displayName: '' });
    expect(
      normalizeRecentLocation({ lat: 1, lon: 2, label: 'A', displayName: 'b'.repeat(200) })
        ?.displayName,
    ).toHaveLength(180);
  });
});

describe('recent locations', () => {
  it('prepends, de-duplicates by coordinates, and caps at four', async () => {
    for (const lat of [1, 2, 3, 4, 5]) await saveRecentLocation(place(lat));
    const next = await saveRecentLocation(place(3, 'Place 3 again'));

    expect(next.map((p) => p.label)).toEqual(['Place 3 again', 'Place 5', 'Place 4', 'Place 2']);
    await expect(loadRecentLocations()).resolves.toEqual(next);
  });

  it('ignores an invalid place', async () => {
    await expect(saveRecentLocation({ lat: 1, lon: 1, label: '' })).resolves.toEqual([]);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('drops malformed entries and non-array payloads', async () => {
    store.set('ww_recent_locations', JSON.stringify([place(1), { lat: 'bad' }]));
    await expect(loadRecentLocations()).resolves.toEqual([place(1)]);

    store.set('ww_recent_locations', JSON.stringify({ lat: 1 }));
    await expect(loadRecentLocations()).resolves.toEqual([]);
  });

  it('reads corrupt storage as empty and reports it', async () => {
    store.set('ww_recent_locations', '[');
    await expect(loadRecentLocations()).resolves.toEqual([]);
    expect(captureError).toHaveBeenCalledWith(expect.anything(), { where: 'loadRecentLocations' });
  });
});

describe('pinned locations', () => {
  it('adds to the front, moves an existing pin forward, and caps at eight', async () => {
    for (const lat of [1, 2, 3, 4, 5, 6, 7, 8, 9]) await addPinnedLocation(place(lat));
    const pins = await addPinnedLocation(place(5));

    expect(pins).toHaveLength(8);
    expect(pins.map((p) => p.lat)).toEqual([5, 9, 8, 7, 6, 4, 3, 2]);
  });

  it('removes a pin by coordinates', async () => {
    await addPinnedLocation(place(1));
    await addPinnedLocation(place(2));
    await expect(removePinnedLocation(1, -100)).resolves.toEqual([place(2)]);
    await expect(loadPinnedLocations()).resolves.toEqual([place(2)]);
  });

  it('ignores an invalid place', async () => {
    await expect(addPinnedLocation({ lat: 1, lon: 1, label: '' })).resolves.toEqual([]);
  });

  it('reads corrupt or non-array storage as empty', async () => {
    store.set('ww_pinned_locations', '"nope"');
    await expect(loadPinnedLocations()).resolves.toEqual([]);

    store.set('ww_pinned_locations', '{');
    await expect(loadPinnedLocations()).resolves.toEqual([]);
    expect(captureError).toHaveBeenCalledWith(expect.anything(), { where: 'loadPinnedLocations' });
  });
});

describe('settings', () => {
  it('loads defaults when nothing is stored', async () => {
    await expect(loadAllSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips every persisted setting in one read', async () => {
    await saveGearMode('pro');
    await saveAppearance('dark');
    await saveTempUnit('celsius');
    await saveExposureLevel('high');
    await saveHomeLocation({ lat: 10, lon: 20, name: 'Home', source: 'manual' });

    await expect(loadAllSettings()).resolves.toEqual({
      gearMode: 'pro',
      appearance: 'dark',
      tempUnit: 'celsius',
      exposureLevel: 'high',
      homeLocation: { lat: 10, lon: 20, name: 'Home', source: 'manual' },
    });
    expect(storage.multiGet).toHaveBeenCalledTimes(1);
  });

  it('falls back to defaults when storage fails', async () => {
    storage.multiGet.mockRejectedValueOnce(new Error('disk full'));
    await expect(loadAllSettings()).resolves.toEqual(DEFAULT_SETTINGS);
    expect(captureError).toHaveBeenCalledWith(expect.anything(), { where: 'loadAllSettings' });
  });
});
