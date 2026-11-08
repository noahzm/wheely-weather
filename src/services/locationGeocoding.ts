import { Platform } from 'react-native';

import { fetchWithTimeout } from './http';

import { formatPlaceLabel } from '@/utils/locationTitle';
import type { LocationSearchResult } from '@/types/weather';

interface NominatimResult {
  address?: Record<string, string | undefined>;
  display_name?: string;
  lat?: string;
  lon?: string;
}

interface SearchOptions {
  signal?: AbortSignal;
}

const SECONDARY_FETCH_TIMEOUT_MS = 6000;
const SEARCH_TIMEOUT_MS = 8000;

// Every non-iOS caller shares the deployed proxy's application-wide limit,
// including development and Android. iOS shadows this file with Apple's APIs.
function geocodeUrl(path: string): string {
  return Platform.OS === 'web' && !__DEV__ ? path : `https://wheelyweather.app${path}`;
}

async function parseNominatimSearchResponse(res: Response): Promise<LocationSearchResult[]> {
  if (res.status === 429) {
    throw new Error('Rate limited');
  }
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  const data = (await res.json()) as NominatimResult[];
  if (!Array.isArray(data)) return [];
  return data
    .map((item): LocationSearchResult | null => {
      if (!item.lat || !item.lon) return null;
      const lat = Number.parseFloat(item.lat);
      const lon = Number.parseFloat(item.lon);
      if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
      const a = item.address ?? {};
      const city =
        a.city ?? a.town ?? a.village ?? a.hamlet ?? a.suburb ?? a.county ?? a.municipality;
      const region = a.state ?? a.region ?? a.country;
      const joined = [city, region].filter(Boolean).join(', ');
      const label = joined === '' ? (item.display_name ?? 'Unknown location') : joined;
      return { lat, lon, label, displayName: item.display_name };
    })
    .filter((place): place is LocationSearchResult => place !== null)
    .filter((place, index, places) => isFirstOfItsName(place, index, places));
}

/**
 * OpenStreetMap can hold one place as several objects (Colorado Springs is both
 * a boundary relation and a boundary way, a few km apart), and Nominatim returns
 * each, so the list showed the same city twice. Keeps the first of each name:
 * Nominatim ranks the more important object first.
 */
function isFirstOfItsName(
  place: LocationSearchResult,
  index: number,
  places: LocationSearchResult[],
): boolean {
  return (
    places.findIndex(
      (other) => other.label === place.label && other.displayName === place.displayName,
    ) === index
  );
}

/** Forward-geocodes a free-text query into a list of place candidates via Nominatim. */
export async function searchLocations(
  query: string,
  { signal }: SearchOptions = {},
): Promise<LocationSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const res = await fetchWithTimeout(
    geocodeUrl(`/api/geocode/search?q=${encodeURIComponent(q)}`),
    { signal },
    SEARCH_TIMEOUT_MS,
  );
  return parseNominatimSearchResponse(res);
}

/**
 * Reverse-geocodes coordinates into a "City, ST" string via Nominatim. US
 * states are abbreviated so device-follow labels match the MapKit search
 * style ("San Francisco, CA", not "San Francisco, California").
 */
export async function fetchLocationName(lat: number, lon: number): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(
      geocodeUrl(`/api/geocode/reverse?lat=${lat}&lon=${lon}`),
      {},
      SECONDARY_FETCH_TIMEOUT_MS,
    );
    const data = (await res.json()) as NominatimResult;
    if (data.address) {
      const { city, town, village, county, state } = data.address;
      return formatPlaceLabel({
        city: city ?? town ?? village ?? county,
        region: state,
        countryCode: data.address.country_code,
      });
    }
  } catch {
    /* empty */
  }
  return 'Your Location';
}
