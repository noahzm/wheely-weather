import { Platform } from 'react-native';
import * as Location from 'expo-location';

import { saveLocation, type SavedLocation } from '@/services/locationStorage';

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
