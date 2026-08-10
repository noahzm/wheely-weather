// Default (Android / web): delegate to the existing Nominatim geocoder.
// The iOS-specific platform file (locationSearch.ios.ts) shadows this with MapKit.
export { searchLocations } from './locationGeocoding';

/**
 * Only iOS returns coordinate-less suggestions (see locationSearch.ios.ts).
 * Nominatim already geocodes as it searches, so nothing is left to resolve.
 */
export function resolveSuggestion(_id: string): Promise<{ lat: number; lon: number } | null> {
  return Promise.resolve(null);
}
