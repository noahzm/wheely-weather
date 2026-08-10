/**
 * Distance math for following the rider's device location. Kept here (pure, no
 * `expo-location` import) so it runs under the node-env unit test project;
 * `hooks/forecast/device-location.ts` owns the actual GPS calls.
 */

export interface Coords {
  lat: number;
  lon: number;
}

/**
 * How far the rider has to move before the forecast is worth refetching. Also
 * used as the `distanceInterval` of the foreground position watch, so iOS/Android
 * only wake us once the threshold is already plausible.
 */
export const LOCATION_FOLLOW_THRESHOLD_M = 2000;

const EARTH_RADIUS_M = 6_371_008.8;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two coordinates, in metres. */
export function distanceMeters(a: Coords, b: Coords): number {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLat = lat2 - lat1;
  const deltaLon = toRadians(b.lon - a.lon);
  const h =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * True when `next` is far enough from `prev` to justify a refetch. A missing
 * `prev` counts as moved — there is nothing to compare against, so the caller
 * should adopt the new fix.
 */
export function hasMovedSignificantly(
  prev: Coords | null | undefined,
  next: Coords,
  thresholdM: number = LOCATION_FOLLOW_THRESHOLD_M,
): boolean {
  if (!prev) return true;
  return distanceMeters(prev, next) >= thresholdM;
}
