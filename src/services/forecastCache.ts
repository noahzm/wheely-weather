import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ForecastSnapshot } from './forecastSnapshot';
import {
  decodeForecastCache,
  encodeForecastCache,
  type CachedForecast,
} from './forecastCacheCodec';
import { loadSavedLocation, type SavedLocation } from './locationStorage';
import { captureError } from './telemetry';

const FORECAST_CACHE_KEY = 'ww_forecast_snapshot';

/**
 * Loads the last cached forecast if it is still fresh and was written for the
 * currently saved location. Best-effort: any failure reads as a cache miss.
 */
export async function loadCachedForecast(): Promise<CachedForecast | null> {
  try {
    const [raw, currentLocation] = await Promise.all([
      AsyncStorage.getItem(FORECAST_CACHE_KEY),
      loadSavedLocation(),
    ]);
    return decodeForecastCache(raw, currentLocation);
  } catch (error) {
    captureError(error, { where: 'loadCachedForecast' });
    return null;
  }
}

/** Persists the latest snapshot for instant paint on the next launch. Best-effort. */
export async function saveCachedForecast(
  snapshot: ForecastSnapshot,
  savedLocation: SavedLocation,
): Promise<void> {
  try {
    const encoded = encodeForecastCache(snapshot, savedLocation);
    if (encoded) await AsyncStorage.setItem(FORECAST_CACHE_KEY, encoded);
  } catch (error) {
    // A failed write just means the next launch falls back to the spinner.
    captureError(error, { where: 'saveCachedForecast' });
  }
}

export async function clearCachedForecast(): Promise<void> {
  try {
    await AsyncStorage.removeItem(FORECAST_CACHE_KEY);
  } catch (error) {
    captureError(error, { where: 'clearCachedForecast' });
  }
}
