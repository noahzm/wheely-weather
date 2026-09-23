import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SavedLocation } from '@/services/locationStorage';

const mocks = vi.hoisted(() => ({
  getForegroundPermissionsAsync: vi.fn(),
  requestForegroundPermissionsAsync: vi.fn(),
  getLastKnownPositionAsync: vi.fn(),
  getCurrentPositionAsync: vi.fn(),
  saveLocation: vi.fn(),
}));

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

vi.mock('expo-location', () => ({
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: mocks.getForegroundPermissionsAsync,
  requestForegroundPermissionsAsync: mocks.requestForegroundPermissionsAsync,
  getLastKnownPositionAsync: mocks.getLastKnownPositionAsync,
  getCurrentPositionAsync: mocks.getCurrentPositionAsync,
}));

vi.mock('@/services/locationStorage', () => ({ saveLocation: mocks.saveLocation }));

const {
  deviceLocationErrorMessage,
  LOCATION_DENIED_MESSAGE,
  LOCATION_UNAVAILABLE_MESSAGE,
  refreshFollowedLocation,
  requestDeviceLocation,
} = await import('./device-location');

// Raleigh, and a spot ~16 km away (past the 2 km follow threshold).
const RALEIGH = { lat: 35.7796, lon: -78.6382 };
const DURHAM_EDGE = { lat: 35.9, lon: -78.7 };

function position({ lat, lon }: { lat: number; lon: number }) {
  return { coords: { latitude: lat, longitude: lon } };
}

const following: SavedLocation = { ...RALEIGH, name: 'Raleigh, NC', source: 'device' };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mocks.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mocks.getLastKnownPositionAsync.mockResolvedValue(null);
  mocks.saveLocation.mockImplementation((location: SavedLocation) => Promise.resolve(location));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('deviceLocationErrorMessage', () => {
  it('tells a denied rider apart from one with no fix', () => {
    expect(deviceLocationErrorMessage('denied')).toBe(LOCATION_DENIED_MESSAGE);
    expect(deviceLocationErrorMessage('unavailable')).toBe(LOCATION_UNAVAILABLE_MESSAGE);
  });
});

describe('requestDeviceLocation', () => {
  it('reports a denied permission without looking up a position', async () => {
    mocks.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    await expect(requestDeviceLocation()).resolves.toEqual({ kind: 'denied' });
    expect(mocks.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('saves a found position as the device location', async () => {
    mocks.getLastKnownPositionAsync.mockResolvedValue(position(RALEIGH));
    const result = await requestDeviceLocation();
    expect(result).toEqual({
      kind: 'located',
      location: { ...RALEIGH, name: null, source: 'device' },
    });
    expect(mocks.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('gives up as unavailable when no fix arrives in time', async () => {
    vi.useFakeTimers();
    // A fix that never arrives, like a simulator with no location set.
    const neverResolves = new Promise<never>(() => {
      // never settles
    });
    mocks.getCurrentPositionAsync.mockReturnValue(neverResolves);
    const pending = requestDeviceLocation();
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(pending).resolves.toEqual({ kind: 'unavailable' });
    expect(mocks.saveLocation).not.toHaveBeenCalled();
  });

  it('reports unavailable when location services fail', async () => {
    mocks.getCurrentPositionAsync.mockRejectedValue(new Error('Location services are disabled'));
    await expect(requestDeviceLocation()).resolves.toEqual({ kind: 'unavailable' });
  });
});

describe('refreshFollowedLocation', () => {
  it('ignores a manually chosen place', async () => {
    const manual: SavedLocation = { ...following, source: 'manual' };
    await expect(refreshFollowedLocation(manual, { allowGps: true })).resolves.toBeNull();
    expect(mocks.getForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('adopts a recent system position once the rider has moved', async () => {
    mocks.getLastKnownPositionAsync.mockResolvedValue(position(DURHAM_EDGE));
    const moved = await refreshFollowedLocation(following, { allowGps: false });
    expect(moved).toEqual({ ...DURHAM_EDGE, name: null, source: 'device' });
    expect(mocks.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('keeps the location when the recent position is within the threshold', async () => {
    mocks.getLastKnownPositionAsync.mockResolvedValue(position(RALEIGH));
    await expect(refreshFollowedLocation(following, { allowGps: true })).resolves.toBeNull();
    expect(mocks.saveLocation).not.toHaveBeenCalled();
  });

  it('leaves the move to the watch when GPS is not allowed', async () => {
    await expect(refreshFollowedLocation(following, { allowGps: false })).resolves.toBeNull();
    expect(mocks.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('takes a fresh fix when GPS is allowed and nothing recent exists', async () => {
    mocks.getCurrentPositionAsync.mockResolvedValue(position(DURHAM_EDGE));
    const moved = await refreshFollowedLocation(following, { allowGps: true });
    expect(moved).toEqual({ ...DURHAM_EDGE, name: null, source: 'device' });
  });

  it('returns null rather than rejecting when the fix fails', async () => {
    mocks.getCurrentPositionAsync.mockRejectedValue(new Error('timeout'));
    await expect(refreshFollowedLocation(following, { allowGps: true })).resolves.toBeNull();
  });
});
