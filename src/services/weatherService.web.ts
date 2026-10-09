// Web: forecasts come from Apple WeatherKit through the site's /api/forecast
// Worker, so web rates the same forecast as iOS. That one request also carries
// WeatherKit's alerts and Open-Meteo's AQI, fetched and cached at the edge.
// Unlike iOS, web falls back to the public APIs (Open-Meteo forecast and AQI,
// NWS alerts) when the Worker fails: it's the backup platform, and the dev
// server (no Worker) always uses them.
// Shared pieces come from weatherParsing.ts / weatherFetch.ts: `./weatherService`
// would resolve back to this file on web.
import { type Thresholds } from '../domain/constants';
import { captureError } from './telemetry';
import {
  fetchAqi,
  fetchForecastBundle,
  fetchNwsAlerts,
  fetchOpenMeteoForecast,
  type ForecastBundle,
} from './weatherFetch';
import { type OpenMeteoData } from './weatherParsing';

import type { ForecastExtras } from '@/types/weather';

export { buildWeatherFromData } from './weatherParsing';
export type { OpenMeteoData } from './weatherParsing';
export { REQUEST_TIMEOUT_ERROR } from './http';

// getForecastSnapshot asks for the forecast and the extras side by side; both
// read the one bundle request in flight for those coordinates.
const inFlight = new Map<string, Promise<ForecastBundle | null>>();

/** The Worker's bundle, or null when it's unavailable (reported once, here). */
function loadBundle(lat: number, lon: number): Promise<ForecastBundle | null> {
  if (__DEV__) return Promise.resolve(null);
  const key = `${lat},${lon}`;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const request = fetchForecastBundle(lat, lon)
    .catch((error: unknown) => {
      captureError(error, { where: 'fetchForecastBundle' });
      return null;
    })
    .finally(() => {
      inFlight.delete(key);
    });
  inFlight.set(key, request);
  return request;
}

export async function fetchOpenMeteoData(lat: number, lon: number): Promise<OpenMeteoData> {
  const bundle = await loadBundle(lat, lon);
  return bundle?.forecast ?? fetchOpenMeteoForecast(lat, lon);
}

/** Fetches slower, non-critical enrichments that can update after first paint. */
export async function fetchWeatherExtras(
  lat: number,
  lon: number,
  _options: { thresholds?: Thresholds } = {},
): Promise<ForecastExtras> {
  const bundle = await loadBundle(lat, lon);
  if (bundle) return { aqi: bundle.aqi, nwsAlerts: bundle.alerts };
  const [aqi, nwsAlerts] = await Promise.all([fetchAqi(lat, lon), fetchNwsAlerts(lat, lon)]);
  return { aqi, nwsAlerts };
}
