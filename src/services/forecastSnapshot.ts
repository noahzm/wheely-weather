import {
  REQUEST_TIMEOUT_ERROR,
  fetchWeatherData,
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

async function fetchSafeLocationName(location: SavedLocation) {
  if (location.name) return location.name;
  return fetchLocationName(location.lat, location.lon)
    .then((name) => name ?? 'Your Location')
    .catch(() => 'Your Location');
}

async function fetchSafeExtras(
  lat: number,
  lon: number,
  mockScenario: string | null,
): Promise<ForecastExtras> {
  try {
    return await fetchWeatherExtras(lat, lon, { mockScenario });
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
}): Promise<ForecastSnapshot> {
  const lastUpdated = new Date();

  if (mockScenario) {
    const weather = buildMockWeather(mockScenario);
    if (!weather) throw new Error(`Unknown mock scenario: ${mockScenario}`);
    return {
      weather,
      location: getMockLocationLabel(mockScenario) ?? 'Mock location',
      lastUpdated,
      isManualLocation: false,
      isDeviceLocation: false,
      mockScenario,
      source: 'mock',
      // Mocks bypass acclimatization so fixtures rate against the base thresholds.
      acclimatization: { homeBaseline: null, thresholds: THRESHOLDS },
    };
  }

  if (!savedLocation) {
    throw new Error('Location required');
  }

  // Resolve the rider's home-climate baseline (cached for a week) and the
  // acclimatization-adjusted thresholds before fetching, so precomputed hourly
  // and daily conditions reflect what the rider is used to.
  const homeBaseline = await getHomeBaseline(homeLocation);
  const thresholds = resolveThresholds(homeBaseline);

  const weatherPromise = fetchWeatherData(savedLocation.lat, savedLocation.lon, { thresholds });
  const locationNamePromise = fetchSafeLocationName(savedLocation);
  const [weather, locationName] = await Promise.all([weatherPromise, locationNamePromise]);
  const extras = await fetchSafeExtras(savedLocation.lat, savedLocation.lon, mockScenario);

  return {
    weather: { ...weather, ...extras },
    location: locationName,
    lastUpdated,
    isManualLocation: savedLocation.source === 'manual',
    isDeviceLocation: savedLocation.source === 'device',
    mockScenario,
    source: savedLocation.source,
    acclimatization: { homeBaseline, thresholds },
  };
}

export function getForecastErrorKind(err: unknown) {
  const maybeError = err as { message?: string } | undefined;
  const isNetworkError = err instanceof TypeError || maybeError?.message === REQUEST_TIMEOUT_ERROR;
  return isNetworkError ? 'network' : 'default';
}
