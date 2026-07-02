import { Platform } from 'react-native';

import { fetchWithTimeout } from './http';

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

// Note: `globalThis.window` is NOT a web check — React Native polyfills
// `window = global` on iOS/Android, so use Platform.OS instead.
function isWebProduction(): boolean {
  return Platform.OS === 'web' && !__DEV__;
}

// Browsers treat User-Agent as a forbidden fetch header (inconsistently
// ignored or rejected); only native callers send Nominatim's required UA.
// Web production goes through the /api/geocode proxy, which sets its own.
function nominatimHeaders(): Record<string, string> {
  return Platform.OS === 'web' ? {} : { 'User-Agent': 'WheelyWeather/1.0' };
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
    .filter((place): place is LocationSearchResult => place !== null);
}

/** Forward-geocodes a free-text query into a list of place candidates via Nominatim. */
export async function searchLocations(
  query: string,
  { signal }: SearchOptions = {},
): Promise<LocationSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  if (isWebProduction()) {
    const res = await fetchWithTimeout(
      `/api/geocode/search?q=${encodeURIComponent(q)}`,
      { signal },
      SEARCH_TIMEOUT_MS,
    );
    return parseNominatimSearchResponse(res);
  }

  const url =
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}` +
    `&format=json&addressdetails=1&limit=5`;
  const res = await fetch(url, {
    headers: nominatimHeaders(),
    signal,
  });
  return parseNominatimSearchResponse(res);
}

/** Reverse-geocodes coordinates into a "City, State" string via Nominatim. */
export async function fetchLocationName(lat: number, lon: number): Promise<string | null> {
  try {
    const reverseUrl = isWebProduction()
      ? `/api/geocode/reverse?lat=${lat}&lon=${lon}`
      : `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
    const fetchOptions = isWebProduction() ? {} : { headers: nominatimHeaders() };
    const res = await fetchWithTimeout(reverseUrl, fetchOptions, SECONDARY_FETCH_TIMEOUT_MS);
    const data = (await res.json()) as NominatimResult;
    if (data.address) {
      const city =
        data.address.city ?? data.address.town ?? data.address.village ?? data.address.county;
      const state = data.address.state;
      return city && state ? `${city}, ${state}` : (city ?? 'Your Location');
    }
  } catch {
    /* empty */
  }
  return 'Your Location';
}
