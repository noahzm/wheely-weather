import { type Thresholds } from '../domain/constants';
import { fetchAqi, fetchNwsAlerts, fetchOpenMeteoForecast } from './weatherFetch';
import { type OpenMeteoData } from './weatherParsing';

import type { ForecastExtras } from '@/types/weather';

export { buildWeatherFromData } from './weatherParsing';
export type { OpenMeteoData } from './weatherParsing';
export { REQUEST_TIMEOUT_ERROR } from './http';

interface WeatherRequestOptions {
  thresholds?: Thresholds;
}

/** Android: Open-Meteo directly. Web prefers WeatherKit (weatherService.web.ts). */
export async function fetchOpenMeteoData(lat: number, lon: number): Promise<OpenMeteoData> {
  return fetchOpenMeteoForecast(lat, lon);
}

/** Fetches slower, non-critical enrichments that can update after first paint. */
export async function fetchWeatherExtras(
  lat: number,
  lon: number,
  _options: WeatherRequestOptions = {},
): Promise<ForecastExtras> {
  const [aqi, nwsAlerts] = await Promise.all([fetchAqi(lat, lon), fetchNwsAlerts(lat, lon)]);
  return { aqi, nwsAlerts };
}
