import {
  REQUEST_TIMEOUT_ERROR,
  buildWeatherFromData,
  fetchOpenMeteoData,
  fetchWeatherExtras,
} from '@/services/weatherService';
import { fetchLocationName } from '@/services/locationGeocoding';
import { buildMockWeather, getMockLocationLabel } from '@/services/mockWeather';
import { getHomeBaseline, type HomeBaseline } from '@/services/homeClimate';
import type { SavedLocation } from '@/services/locationStorage';
import { THRESHOLDS, resolveThresholds } from '@/domain';
import type { ForecastExtras, Weather } from '@/types/weather';

export interface AcclimatizationContext {
  homeBaseline: HomeBaseline | null;
  thresholds: typeof THRESHOLDS;
}

export interface ForecastSnapshot {
  weather: Weather;
  location: string;
  lastUpdated: Date;
  isManualLocation: boolean;
  isDeviceLocation: boolean;
  mockScenario: string | null;
  source: 'manual' | 'device' | 'mock';
  acclimatization: AcclimatizationContext;
}

export interface ForecastSnapshotResult {
  snapshot: ForecastSnapshot;
  /**
   * Slower, non-critical enrichments (AQI, NWS alerts) that must not hold up
   * first paint. Resolves null when there is nothing to merge (mock data).
   * Never rejects.
   */
  extras: Promise<ForecastExtras | null>;
}

async function fetchSafeLocationName(location: SavedLocation) {
  if (location.name) return location.name;
  return fetchLocationName(location.lat, location.lon)
    .then((name) => name ?? 'Your Location')
    .catch(() => 'Your Location');
}

async function fetchSafeExtras(lat: number, lon: number): Promise<ForecastExtras> {
  try {
    return await fetchWeatherExtras(lat, lon);
  } catch {
    return { aqi: null, nwsAlerts: [] };
  }
}

export async function getForecastSnapshot({
  savedLocation,
  homeLocation = null,
  mockScenario = null,
}: {
  savedLocation: SavedLocation | null;
  homeLocation?: SavedLocation | null;
  mockScenario?: string | null;
}): Promise<ForecastSnapshotResult> {
  const lastUpdated = new Date();

  if (mockScenario) {
    const weather = buildMockWeather(mockScenario);
    if (!weather) throw new Error(`Unknown mock scenario: ${mockScenario}`);
    return {
      snapshot: {
        weather,
        location: getMockLocationLabel(mockScenario) ?? 'Mock location',
        lastUpdated,
        isManualLocation: false,
        isDeviceLocation: false,
        mockScenario,
        source: 'mock',
        // Mocks bypass acclimatization so fixtures rate against the base thresholds.
        acclimatization: { homeBaseline: null, thresholds: THRESHOLDS },
      },
      // Mock fixtures carry their own alerts inside `weather`; nothing to merge.
      extras: Promise.resolve(null),
    };
  }

  if (!savedLocation) {
    throw new Error('Location required');
  }

  // Everything network-bound starts at once: the raw forecast (the long pole),
  // the home-climate baseline (usually an AsyncStorage cache hit) that the
  // condition ratings need, the reverse-geocoded name, and the non-critical
  // extras — which are intentionally NOT awaited so they can land after first
  // paint via the returned promise.
  const extras = fetchSafeExtras(savedLocation.lat, savedLocation.lon);
  const [data, homeBaseline, locationName] = await Promise.all([
    fetchOpenMeteoData(savedLocation.lat, savedLocation.lon),
    getHomeBaseline(homeLocation),
    fetchSafeLocationName(savedLocation),
  ]);
  const thresholds = resolveThresholds(homeBaseline);
  const weather = buildWeatherFromData(data, thresholds);

  return {
    snapshot: {
      weather,
      location: locationName,
      lastUpdated,
      isManualLocation: savedLocation.source === 'manual',
      isDeviceLocation: savedLocation.source === 'device',
      mockScenario,
      source: savedLocation.source,
      acclimatization: { homeBaseline, thresholds },
    },
    extras,
  };
}

export function getForecastErrorKind(err: unknown) {
  const maybeError = err as { message?: string } | undefined;
  const isNetworkError = err instanceof TypeError || maybeError?.message === REQUEST_TIMEOUT_ERROR;
  return isNetworkError ? 'network' : 'default';
}
