// Network calls behind the forecast: the raw forecast payload (Open-Meteo, or
// WeatherKit through the site's Worker) and the secondary AQI and NWS lookups.
// Parsing lives in weatherParsing.ts; platform choice in weatherService*.ts.
import { fetchWithTimeout } from './http';
import type { OpenMeteoData } from './weatherParsing';

import type { WeatherAlert } from '@/types/weather';

interface NwsFeature {
  properties: {
    severity?: string;
    event?: string;
    headline?: string;
    description?: string;
    instruction?: string;
    expires?: string;
  };
}

// Keep secondary lookups snappy so slower third-party APIs do not hold up first paint.
// WeatherKit alerts (weatherService.ios.ts) use their own, longer budget.
const SECONDARY_FETCH_TIMEOUT_MS = 2500;
// WeatherKit's first call on a fresh install involves authentication token
// negotiation with Apple's servers plus a CLGeocoder reverse-geocode for
// timezone resolution — easily 10-15 s, so the old 8 s ceiling timed out
// before the data could arrive (TestFlight "Can't connect" symptom).
export const FORECAST_FETCH_TIMEOUT_MS = 20_000;

/** Maps NWS severity strings to our severity levels. */
const NWS_SEVERITY: Record<string, WeatherAlert['severity']> = {
  Extreme: 'extreme',
  Severe: 'extreme',
  Moderate: 'warning',
  Minor: 'warning',
  Unknown: 'warning',
};

/**
 * Fetches active NWS alerts for the given coordinates.
 * US-only (api.weather.gov); returns an empty array for non-US locations or on failure.
 */
export async function fetchNwsAlerts(lat: number, lon: number): Promise<WeatherAlert[]> {
  try {
    const res = await fetchWithTimeout(
      `https://api.weather.gov/alerts/active?point=${lat},${lon}`,
      {
        headers: {
          'User-Agent': 'WheelyWeather/1.0',
          Accept: 'application/geo+json',
        },
      },
      SECONDARY_FETCH_TIMEOUT_MS,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { features?: NwsFeature[] };
    const features = data.features ?? [];
    return features.map((f) => {
      const p = f.properties;
      return {
        type: 'nws',
        severity: p.severity ? (NWS_SEVERITY[p.severity] ?? 'warning') : 'warning',
        event: p.event,
        headline: p.headline,
        description: p.description,
        instruction: p.instruction,
        expires: p.expires,
      };
    });
  } catch {
    /* empty */
  }
  return [];
}

/**
 * Fetches the raw Open-Meteo forecast payload. Split from parsing so the
 * network round-trip can run in parallel with resolving the acclimatization
 * thresholds that parsing needs.
 */
export async function fetchOpenMeteoForecast(lat: number, lon: number): Promise<OpenMeteoData> {
  const res = await fetchWithTimeout(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,dewpoint_2m,wind_direction_10m` +
      `&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m,weather_code,dewpoint_2m,uv_index` +
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

// Leaves room inside FORECAST_FETCH_TIMEOUT_MS for the Open-Meteo fallback.
const FORECAST_PROXY_TIMEOUT_MS = 8000;

/** The body of the Worker's `/api/forecast`: everything web needs in one response. */
export interface ForecastBundle {
  forecast: OpenMeteoData;
  /** WeatherKit alerts (US and Canada); empty elsewhere. */
  alerts: WeatherAlert[];
  aqi: number | null;
}

/**
 * Fetches the WeatherKit forecast, its alerts and AQI through the site's
 * /api/forecast Worker (workers/index.ts), the forecast already reshaped into
 * `OpenMeteoData`. Web only: the relative URL needs the deployed site's origin.
 */
export async function fetchForecastBundle(lat: number, lon: number): Promise<ForecastBundle> {
  const res = await fetchWithTimeout(
    `/api/forecast?lat=${lat}&lon=${lon}`,
    {},
    FORECAST_PROXY_TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`Forecast proxy error ${res.status}`);
  const bundle = (await res.json()) as Partial<ForecastBundle> | null;
  if (!bundle?.forecast?.current) throw new Error('Forecast proxy missing current data');
  return { forecast: bundle.forecast, alerts: bundle.alerts ?? [], aqi: bundle.aqi ?? null };
}

/** Fetches the current US AQI from the Open-Meteo air quality API. Returns null on failure. */
export async function fetchAqi(lat: number, lon: number): Promise<number | null> {
  try {
    const res = await fetchWithTimeout(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`,
      {},
      SECONDARY_FETCH_TIMEOUT_MS,
    );
    if (res.ok) {
      const data = (await res.json()) as { current?: { us_aqi?: number } };
      return data.current?.us_aqi ?? null;
    }
  } catch {
    /* empty */
  }
  return null;
}
