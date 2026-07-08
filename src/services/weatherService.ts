import { THRESHOLDS, type Thresholds } from '../domain/constants';
import { fetchWithTimeout } from './http';
import {
  buildWeatherFromData,
  fetchAqi,
  fetchNwsAlerts,
  FORECAST_FETCH_TIMEOUT_MS,
  type OpenMeteoData,
} from './weatherParsing';

import type { ForecastExtras, Weather } from '@/types/weather';

export {
  buildWeatherFromData,
  fetchAqi,
  fetchNwsAlerts,
  SECONDARY_FETCH_TIMEOUT_MS,
  FORECAST_FETCH_TIMEOUT_MS,
} from './weatherParsing';
export type { OpenMeteoData } from './weatherParsing';
export { REQUEST_TIMEOUT_ERROR } from './http';

interface WeatherRequestOptions {
  thresholds?: Thresholds;
}

/**
 * Fetches the raw Open-Meteo forecast payload. Split from parsing so the
 * network round-trip can run in parallel with resolving the acclimatization
 * thresholds that parsing needs.
 */
export async function fetchOpenMeteoData(lat: number, lon: number): Promise<OpenMeteoData> {
  const res = await fetchWithTimeout(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,dewpoint_2m,wind_direction_10m` +
      `&hourly=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,wind_gusts_10m,weather_code,dewpoint_2m,uv_index` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,apparent_temperature_max,weather_code,sunset,sunrise,uv_index_max` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=8&past_hours=12`,
    {},
    FORECAST_FETCH_TIMEOUT_MS,
  );
  if (!res.ok) throw new Error('Weather API error');
  const data = (await res.json()) as OpenMeteoData;
  if (!data.current) throw new Error('Weather API missing current data');
  return data;
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

/**
 * Fetches current, hourly, and daily weather from Open-Meteo and assembles the
 * unified weather object used by the UI.
 */
export async function fetchWeatherData(
  lat: number,
  lon: number,
  options: WeatherRequestOptions = {},
): Promise<Weather> {
  const data = await fetchOpenMeteoData(lat, lon);
  return buildWeatherFromData(data, options.thresholds ?? THRESHOLDS);
}
