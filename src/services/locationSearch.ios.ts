// iOS: Use Apple MapKit (MKLocalSearch) via the local native module.
// The module returns null until a native rebuild links it — search is unavailable
// in that state (no Nominatim fallback).
import AppleLocationSearchModule from '../../modules/apple-location-search/src/AppleLocationSearchModule';
import type { RecentLocation } from './locationStorage';

export async function searchLocations(
  query: string,
  { signal }: { signal?: AbortSignal } = {},
): Promise<RecentLocation[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  if (!AppleLocationSearchModule) {
    throw new Error('MapKit search not available — rebuild the native app.');
  }

  const results = await Promise.race([
    AppleLocationSearchModule.search(trimmed),
    new Promise<never>((_, reject) => {
      signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      });
    }),
  ]);

  return results.map((r) => ({
    lat: r.lat,
    lon: r.lon,
    label: r.label,
    displayName: r.displayName,
  }));
}
