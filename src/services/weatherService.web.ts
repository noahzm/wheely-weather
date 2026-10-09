// Web: forecasts come from Apple WeatherKit through the site's /api/weather
// Worker, so web rates the same forecast as iOS. Unlike iOS, web falls back to
// Open-Meteo when WeatherKit fails: it's the backup platform, and the dev
// server (no Worker) always uses Open-Meteo. AQI and NWS alerts are unchanged.
// Shared pieces come from weatherParsing.ts: `./weatherService` would resolve
// back to this file on web.
import { type Thresholds } from '../domain/constants';
import { captureError } from './telemetry';
import {
  fetchAqi,
  fetchNwsAlerts,
  fetchOpenMeteoForecast,
  fetchWeatherKitProxyForecast,
  type OpenMeteoData,
} from './weatherParsing';

import type { ForecastExtras } from '@/types/weather';

export { buildWeatherFromData, fetchAqi, fetchNwsAlerts } from './weatherParsing';
export type { OpenMeteoData } from './weatherParsing';
export { REQUEST_TIMEOUT_ERROR } from './http';

export async function fetchOpenMeteoData(lat: number, lon: number): Promise<OpenMeteoData> {
  if (__DEV__) return fetchOpenMeteoForecast(lat, lon);
  try {
    return await fetchWeatherKitProxyForecast(lat, lon);
  } catch (error) {
    captureError(error, { where: 'fetchWeatherKitProxyForecast' });
    return fetchOpenMeteoForecast(lat, lon);
  }
}

/** Fetches slower, non-critical enrichments that can update after first paint. */
export async function fetchWeatherExtras(
  lat: number,
  lon: number,
  _options: { thresholds?: Thresholds } = {},
): Promise<ForecastExtras> {
  const [aqi, nwsAlerts] = await Promise.all([fetchAqi(lat, lon), fetchNwsAlerts(lat, lon)]);
  return { aqi, nwsAlerts };
}
