import {
  DEFAULT_LAT,
  DEFAULT_LOCATION,
  DEFAULT_LON,
  REQUEST_TIMEOUT_ERROR,
  fetchWeatherData,
  fetchWeatherExtras,
} from '@/services/weatherService';
import { fetchLocationName } from '@/services/locationGeocoding';
import {
  buildMockWeather,
  getMockLocationLabel,
} from '@/services/mockWeather';
import type { SavedLocation } from '@/services/locationStorage';
import type { ForecastExtras, Weather } from '@/types/weather';

export type ForecastSnapshot = {
  weather: Weather;
  location: string;
  lastUpdated: Date;
  isFallbackLocation: boolean;
  isManualLocation: boolean;
  isDeviceLocation: boolean;
  mockScenario: string | null;
  source: 'fallback' | 'manual' | 'device' | 'mock';
};

async function fetchSafeLocationName(location: SavedLocation | FallbackLocation, isFallback: boolean) {
  if (location.name) return location.name;
  if (isFallback) return DEFAULT_LOCATION;
  return fetchLocationName(location.lat, location.lon)
    .then((name) => name || 'Your Location')
    .catch(() => 'Your Location');
}

async function fetchSafeExtras(lat: number, lon: number, mockScenario: string | null): Promise<ForecastExtras> {
  try {
    return await fetchWeatherExtras(lat, lon, { mockScenario });
  } catch {
    return { aqi: null, nwsAlerts: [] };
  }
}

type FallbackLocation = {
  lat: number;
  lon: number;
  name: string;
  source: 'fallback';
};

export async function getForecastSnapshot({
  savedLocation,
  mockScenario = null,
}: {
  savedLocation: SavedLocation | null;
  mockScenario?: string | null;
}): Promise<ForecastSnapshot> {
  const lastUpdated = new Date();

  if (mockScenario) {
    const weather = buildMockWeather(mockScenario);
    if (!weather) throw new Error(`Unknown mock scenario: ${mockScenario}`);
    return {
      weather,
      location: getMockLocationLabel(mockScenario) || DEFAULT_LOCATION,
      lastUpdated,
      isFallbackLocation: false,
      isManualLocation: false,
      isDeviceLocation: false,
      mockScenario,
      source: 'mock',
    };
  }

  const isFallbackLocation = !savedLocation;
  const location: SavedLocation | FallbackLocation = savedLocation ?? {
    lat: DEFAULT_LAT,
    lon: DEFAULT_LON,
    name: DEFAULT_LOCATION,
    source: 'fallback',
  };

  const weatherPromise = fetchWeatherData(location.lat, location.lon);
  const locationNamePromise = fetchSafeLocationName(location, isFallbackLocation);
  const [weather, locationName] = await Promise.all([weatherPromise, locationNamePromise]);
  const extras = await fetchSafeExtras(location.lat, location.lon, mockScenario);

  return {
    weather: { ...weather, ...extras },
    location: locationName,
    lastUpdated,
    isFallbackLocation,
    isManualLocation: savedLocation?.source === 'manual',
    isDeviceLocation: savedLocation?.source === 'device',
    mockScenario,
    source: savedLocation?.source ?? 'fallback',
  };
}

export function getForecastErrorKind(err: unknown) {
  const maybeError = err as { message?: string } | undefined;
  const isNetworkError = err instanceof TypeError || maybeError?.message === REQUEST_TIMEOUT_ERROR;
  return isNetworkError ? 'network' : 'default';
}
