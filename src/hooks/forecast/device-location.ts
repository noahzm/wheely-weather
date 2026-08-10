import { Platform } from 'react-native';
import * as Location from 'expo-location';

import { saveLocation, type SavedLocation } from '@/services/locationStorage';
import { hasMovedSignificantly, type Coords } from '@/utils/geo';

export const LOCATION_DENIED_MESSAGE = 'Location access denied. Search for a city instead.';
export const LOCATION_INSECURE_MESSAGE =
  'Location requires a secure connection (HTTPS). Search for a city instead.';

export function isWebInsecureContext(): boolean {
  return Platform.OS === 'web' && !globalThis.isSecureContext;
}

export async function resolveDeviceLocation(
  requestIfUndetermined: boolean,
): Promise<SavedLocation | null> {
  let permission = await Location.getForegroundPermissionsAsync();
  if (permission.status === Location.PermissionStatus.UNDETERMINED && requestIfUndetermined) {
    permission = await Location.requestForegroundPermissionsAsync();
  }
  if (permission.status !== Location.PermissionStatus.GRANTED) {
    return null;
  }
  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return saveLocation({
    lat: position.coords.latitude,
    lon: position.coords.longitude,
    name: null,
    source: 'device',
  });
}

export async function requestDeviceLocation(): Promise<SavedLocation | null> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== Location.PermissionStatus.GRANTED) {
    return null;
  }
  return resolveDeviceLocation(false);
}

/** True while the active location is the device fix, i.e. we should follow it. */
export function isFollowingDevice(current: SavedLocation | null | undefined): boolean {
  return current?.source === 'device' && !isWebInsecureContext();
}

/**
 * Persists a device fix as the active location, dropping any previously resolved
 * city name so reverse geocoding re-labels the new spot (`persistResolvedDeviceName`
 * writes the fresh one back once the forecast lands).
 */
export function adoptDeviceFix(coords: Coords): Promise<SavedLocation> {
  return saveLocation({ lat: coords.lat, lon: coords.lon, name: null, source: 'device' });
}

/**
 * Silently re-reads the device position and adopts it only when the rider has
 * moved past the threshold. Never prompts (a background check must not raise a
 * system dialog) and never rejects — returns null when we are not following, the
 * permission is gone, the fix fails, or nothing meaningful changed.
 */
export async function refreshFollowedLocation(
  current: SavedLocation | null,
): Promise<SavedLocation | null> {
  if (!isFollowingDevice(current)) return null;
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== Location.PermissionStatus.GRANTED) return null;
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const next = { lat: position.coords.latitude, lon: position.coords.longitude };
    if (!hasMovedSignificantly(current, next)) return null;
    return await adoptDeviceFix(next);
  } catch {
    // GPS off, permission revoked mid-flight, storage failure: keep the last
    // known location rather than surfacing an error for an automatic check.
    return null;
  }
}
