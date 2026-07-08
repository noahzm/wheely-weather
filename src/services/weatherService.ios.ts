// iOS: source current/hourly/daily conditions and severe-weather alerts from
// Apple WeatherKit via the local native module, reshaped into the same
// `OpenMeteoData` wire format `buildWeatherFromData` (unchanged, imported
// from weatherParsing.ts) already normalizes — see weatherkit-codes.ts for
// the condition-code translation. AQI stays on Open-Meteo (WeatherKit has no
// AQI data). Note: this file must import shared parsing from weatherParsing.ts,
// not weatherService.ts — Metro's platform resolution would resolve
// `./weatherService` back to this very file on iOS, causing infinite recursion.
// The module returns null until a native rebuild links it — forecasts are
// unavailable in that state (no Open-Meteo fallback), matching how
// locationSearch.ios.ts treats MapKit search.
import AppleWeatherKitModule from '../../modules/apple-weatherkit/src/AppleWeatherKitModule';
import { THRESHOLDS, type Thresholds } from '../domain/constants';
import { weatherKitConditionToWmoCode } from '../domain/weatherkit-codes';
import { withTimeout } from './http';
import {
  buildWeatherFromData,
  fetchAqi,
  FORECAST_FETCH_TIMEOUT_MS,
  SECONDARY_FETCH_TIMEOUT_MS,
  type OpenMeteoData,
} from './weatherParsing';

import type { ForecastExtras, Weather, WeatherAlert } from '@/types/weather';

import type {
  WeatherKitAlert,
  WeatherKitForecastResult,
} from '../../modules/apple-weatherkit/src/AppleWeatherKit.types';

export { buildWeatherFromData, fetchAqi, fetchNwsAlerts } from './weatherParsing';
export type { OpenMeteoData } from './weatherParsing';
export { REQUEST_TIMEOUT_ERROR } from './http';

/** Maps WeatherKit's 4-tier severity (plus "unknown") to the app's 2-tier scheme. */
const WEATHERKIT_SEVERITY: Record<string, WeatherAlert['severity']> = {
  minor: 'warning',
  moderate: 'warning',
  unknown: 'warning',
  severe: 'extreme',
  extreme: 'extreme',
};

function toOpenMeteoData(result: WeatherKitForecastResult): OpenMeteoData {
  return {
    utc_offset_seconds: result.utc_offset_seconds,
    current: {
      time: result.current.time,
      temperature_2m: result.current.temperature_2m,
      apparent_temperature: result.current.apparent_temperature,
      wind_speed_10m: result.current.wind_speed_10m,
      wind_gusts_10m: result.current.wind_gusts_10m,
      dewpoint_2m: result.current.dewpoint_2m,
      weather_code: weatherKitConditionToWmoCode(result.current.condition),
      wind_direction_10m: result.current.wind_direction_10m,
    },
    hourly: {
      time: result.hourly.time,
      temperature_2m: result.hourly.temperature_2m,
      apparent_temperature: result.hourly.apparent_temperature,
      wind_speed_10m: result.hourly.wind_speed_10m,
      wind_gusts_10m: result.hourly.wind_gusts_10m,
      precipitation_probability: result.hourly.precipitation_probability,
      weather_code: result.hourly.condition.map((condition) =>
        weatherKitConditionToWmoCode(condition),
      ),
      dewpoint_2m: result.hourly.dewpoint_2m,
      uv_index: result.hourly.uv_index,
    },
    daily: {
      time: result.daily.time,
      sunrise: result.daily.sunrise,
      sunset: result.daily.sunset,
      apparent_temperature_max: result.daily.apparent_temperature_max,
      temperature_2m_max: result.daily.temperature_2m_max,
      temperature_2m_min: result.daily.temperature_2m_min,
      wind_speed_10m_max: result.daily.wind_speed_10m_max,
      wind_gusts_10m_max: result.daily.wind_gusts_10m_max,
      precipitation_probability_max: result.daily.precipitation_probability_max,
      weather_code: result.daily.condition.map((condition) =>
        weatherKitConditionToWmoCode(condition),
      ),
      uv_index_max: result.daily.uv_index_max,
    },
  };
}

function toWeatherAlert(alert: WeatherKitAlert): WeatherAlert {
  return {
    type: 'weatherkit',
    severity: WEATHERKIT_SEVERITY[alert.severity] ?? 'warning',
    event: alert.summary,
    headline: alert.summary,
    message: alert.summary,
    expires: alert.expirationDate,
  };
}

/**
 * Fetches the current/hourly/daily forecast from WeatherKit, reshaped into
 * the same `OpenMeteoData` wire format the Android/web fetch produces.
 */
export async function fetchOpenMeteoData(lat: number, lon: number): Promise<OpenMeteoData> {
  if (!AppleWeatherKitModule) {
    throw new Error('WeatherKit not available — rebuild the native app.');
  }
  const result = await withTimeout(
    AppleWeatherKitModule.forecast(lat, lon),
    FORECAST_FETCH_TIMEOUT_MS,
  );
  return toOpenMeteoData(result);
}

async function fetchWeatherKitAlerts(lat: number, lon: number): Promise<WeatherAlert[]> {
  try {
    if (!AppleWeatherKitModule) return [];
    const alerts = await withTimeout(
      AppleWeatherKitModule.alerts(lat, lon),
      SECONDARY_FETCH_TIMEOUT_MS,
    );
    return alerts.map((alert) => toWeatherAlert(alert));
  } catch {
    return [];
  }
}

/**
 * Fetches slower, non-critical enrichments. AQI stays on Open-Meteo
 * (WeatherKit has no AQI dataset); alerts come from WeatherKit instead of NWS.
 */
export async function fetchWeatherExtras(
  lat: number,
  lon: number,
  _options: { thresholds?: Thresholds } = {},
): Promise<ForecastExtras> {
  const [aqi, nwsAlerts] = await Promise.all([fetchAqi(lat, lon), fetchWeatherKitAlerts(lat, lon)]);
  return { aqi, nwsAlerts };
}

/**
 * Fetches WeatherKit current/hourly/daily data and assembles the unified
 * weather object used by the UI.
 */
export async function fetchWeatherData(
  lat: number,
  lon: number,
  options: { thresholds?: Thresholds } = {},
): Promise<Weather> {
  const data = await fetchOpenMeteoData(lat, lon);
  return buildWeatherFromData(data, options.thresholds ?? THRESHOLDS);
}
