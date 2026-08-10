// iOS: Use Apple MapKit (MKLocalSearchCompleter) via the local native module.
// The module returns null until a native rebuild links it — search is unavailable
// in that state (no Nominatim fallback).
import AppleLocationSearchModule from '../../modules/apple-location-search/src/AppleLocationSearchModule';
import type { ResolvedCoordinates } from '../../modules/apple-location-search/src/AppleLocationSearch.types';
import type { RowItem } from '@/utils/locationRows';

/**
 * Completer suggestions have no coordinates, so rows come back with placeholder
 * zeros plus a `_completionId`; `resolveSuggestion` fills in the real position
 * once the user commits to one.
 */
export async function searchLocations(
  query: string,
  { signal }: { signal?: AbortSignal } = {},
): Promise<RowItem[]> {
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
    lat: 0,
    lon: 0,
    label: r.label,
    displayName: r.displayName,
    _completionId: r.id,
  }));
}

export async function resolveSuggestion(id: string): Promise<ResolvedCoordinates | null> {
  if (!AppleLocationSearchModule) {
    throw new Error('MapKit search not available — rebuild the native app.');
  }
  return AppleLocationSearchModule.resolve(id);
}
