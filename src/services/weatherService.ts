import {
  getWeatherDescription,
  isThunderstorm,
  getHourlyCondition,
  getDailyCondition,
} from '../domain/weather';
import { THRESHOLDS, type Thresholds } from '../domain/constants';
import { fetchWithTimeout } from './http';

import type {
  DailyWeather,
  ForecastExtras,
  HourlyWeather,
  Weather,
  WeatherAlert,
} from '@/types/weather';

interface DaylightHours {
  sunriseHour: number;
  sunsetHour: number;
}

interface TempRange {
  min: number;
  max: number;
}

interface OpenMeteoHourly {
  time: string[];
  temperature_2m: number[];
  apparent_temperature: number[];
  wind_speed_10m: number[];
  wind_gusts_10m?: (number | null)[];
  precipitation_probability: number[];
  weather_code: number[];
  dewpoint_2m: number[];
  uv_index?: (number | null)[];
}

interface OpenMeteoDaily {
  time: string[];
  sunrise?: string[];
  sunset?: string[];
  apparent_temperature_max: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  wind_speed_10m_max: number[];
  wind_gusts_10m_max?: (number | null)[];
  precipitation_probability_max: number[];
  weather_code: number[];
  uv_index_max?: (number | null)[];
}

export interface OpenMeteoData {
  utc_offset_seconds?: number;
  current?: {
    time?: string;
    temperature_2m: number;
    apparent_temperature: number;
    wind_speed_10m: number;
    wind_gusts_10m?: number | null;
    dewpoint_2m: number;
    weather_code: number;
    wind_direction_10m?: number | null;
  };
  hourly: OpenMeteoHourly;
  daily: OpenMeteoDaily;
}

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

interface WeatherRequestOptions {
  thresholds?: Thresholds;
}

// Keep secondary lookups snappy so slower third-party APIs do not hold up first paint.
const SECONDARY_FETCH_TIMEOUT_MS = 2500;
const FORECAST_FETCH_TIMEOUT_MS = 8000;

/** Normalizes a forecast timestamp down to the hourly format used by hourly.time. */
function toHourlyTimeKey(timeStr: string | null | undefined): string | null {
  if (!timeStr) return null;
  return `${timeStr.slice(0, 13)}:00`;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Computes the current hour as a naive ISO string in the forecast location's timezone. */
function currentHourStrForLocation(data: OpenMeteoData): string {
  const offsetSeconds = data.utc_offset_seconds ?? 0;
  const localMs = Date.now() + offsetSeconds * 1000;
  const d = new Date(localMs);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}:00`;
}

/** Builds a normalized hour record from one row of Open-Meteo hourly arrays. */
function buildHourRecord(
  data: OpenMeteoData,
  idx: number,
  thresholds: Thresholds,
): HourlyWeather | null {
  const t = data.hourly.time[idx];
  const temperature = data.hourly.temperature_2m[idx];
  const feelsLike = data.hourly.apparent_temperature[idx];
  const wind = data.hourly.wind_speed_10m[idx];
  if (t == null || temperature == null || feelsLike == null || wind == null) return null;
  const gust = data.hourly.wind_gusts_10m?.[idx] ?? null;
  const rain = data.hourly.precipitation_probability[idx] ?? 0;
  const code = data.hourly.weather_code[idx] ?? null;
  const dewpoint = data.hourly.dewpoint_2m[idx] ?? null;
  const uv = data.hourly.uv_index?.[idx] ?? 0;
  return {
    hour: Number.parseInt(t.slice(11, 13), 10),
    temperature,
    feelsLike,
    windSpeed: wind,
    windGust: gust,
    rainChance: rain,
    dewpoint,
    weatherCode: code,
    uv,
    condition: getHourlyCondition({ temperature, wind, gust, rain, code, dewpoint }, thresholds),
  };
}

/** Extracts the next 24 hours of forecast data starting from the current hour. */
function parseHourly(
  data: OpenMeteoData,
  currentHourStr: string,
  thresholds: Thresholds,
): HourlyWeather[] {
  const startIdx = data.hourly.time.indexOf(currentHourStr);
  const offset = Math.max(startIdx, 0);
  return Array.from({ length: 24 }, (_, i) => buildHourRecord(data, offset + i, thresholds)).filter(
    (hour): hour is HourlyWeather => hour !== null,
  );
}

/** Extracts up to `count` hours preceding the current hour. */
function parsePastHourly(
  data: OpenMeteoData,
  currentHourStr: string,
  count: number,
  thresholds: Thresholds,
): HourlyWeather[] {
  const currentIdx = data.hourly.time.indexOf(currentHourStr);
  if (currentIdx <= 0) return [];
  const startIdx = Math.max(0, currentIdx - count);
  return Array.from({ length: currentIdx - startIdx }, (_, i) =>
    buildHourRecord(data, startIdx + i, thresholds),
  ).filter((hour): hour is HourlyWeather => hour !== null);
}

/**
 * Per-date daylight window (sunrise/sunset hours) so temperature can be rated on
 * ridable hours only, ignoring overnight lows nobody would ride in.
 */
function buildDaylightByDate(data: OpenMeteoData): Record<string, DaylightHours> {
  const daylightByDate: Record<string, DaylightHours> = {};
  for (const [i, dateStr] of data.daily.time.entries()) {
    const sr = data.daily.sunrise?.[i];
    const ss = data.daily.sunset?.[i];
    if (sr && ss) {
      daylightByDate[dateStr] = {
        sunriseHour: Number.parseInt(sr.slice(11, 13), 10),
        sunsetHour: Number.parseInt(ss.slice(11, 13), 10),
      };
    }
  }
  return daylightByDate;
}

/** Tracks the running max for a date key, ignoring null values. */
function bumpMax(map: Record<string, number>, key: string, value: number | null | undefined): void {
  if (value != null && (map[key] == null || value > map[key])) map[key] = value;
}

/** Tracks the running min/max range for a date key, ignoring null values. */
function bumpRange(
  map: Record<string, TempRange>,
  key: string,
  value: number | null | undefined,
): void {
  if (value == null) return;
  const cur = map[key];
  if (!cur) {
    map[key] = { min: value, max: value };
    return;
  }
  if (value < cur.min) cur.min = value;
  if (value > cur.max) cur.max = value;
}

/**
 * Aggregates hourly data into per-date peak dewpoint, peak UV, and the daytime
 * air-temperature range (limited to daylight hours).
 */
function buildDaytimeAggregates(
  data: OpenMeteoData,
  daylightByDate: Record<string, DaylightHours>,
): { dewpointByDate: Record<string, number>; daytimeTempByDate: Record<string, TempRange> } {
  const dewpointByDate: Record<string, number> = {};
  const daytimeTempByDate: Record<string, TempRange> = {};
  for (const [i, t] of data.hourly.time.entries()) {
    const date = t.slice(0, 10);
    bumpMax(dewpointByDate, date, data.hourly.dewpoint_2m[i]);

    const dl = daylightByDate[date];
    const hour = Number.parseInt(t.slice(11, 13), 10);
    if (!dl || hour < dl.sunriseHour || hour >= dl.sunsetHour) continue;

    bumpRange(daytimeTempByDate, date, data.hourly.temperature_2m[i]);
  }
  return { dewpointByDate, daytimeTempByDate };
}

/** Parses the 8-day daily forecast into a simplified array with cycling conditions. */
function parseDaily(data: OpenMeteoData, thresholds: Thresholds): DailyWeather[] {
  const daylightByDate = buildDaylightByDate(data);
  const { dewpointByDate, daytimeTempByDate } = buildDaytimeAggregates(data, daylightByDate);

  return data.daily.time.flatMap((dateStr, i) => {
    const high = data.daily.temperature_2m_max[i];
    const low = data.daily.temperature_2m_min[i];
    const windSpeed = data.daily.wind_speed_10m_max[i];
    const rainChance = data.daily.precipitation_probability_max[i];
    // Skip any day missing a required field (parallel arrays should never be
    // short, but bail rather than fabricate 0° / 0% values if they are).
    if (high == null || low == null || windSpeed == null || rainChance == null) return [];

    const apparentMax = data.daily.apparent_temperature_max[i] ?? null;
    const daytime = daytimeTempByDate[dateStr];
    // Rate temperature on the worst air temperature across daylight hours; fall
    // back to the day's high/low when daylight coverage is missing.
    const tempLow = daytime ? daytime.min : low;
    const tempHigh = daytime ? daytime.max : high;
    const gust = data.daily.wind_gusts_10m_max?.[i] ?? null;
    const code = data.daily.weather_code[i] ?? null;
    const dewpoint = dewpointByDate[dateStr] ?? null;
    return [
      {
        date: new Date(dateStr + 'T12:00:00'),
        high: Math.round(high),
        low: Math.round(low),
        feelsLike: apparentMax,
        dewpoint,
        windSpeed,
        windGust: gust,
        rainChance,
        weatherCode: code,
        condition: getDailyCondition(
          { tempLow, tempHigh, wind: windSpeed, gust, rain: rainChance, code, dewpoint },
          thresholds,
        ),
      },
    ];
  });
}

/** Formats a naive datetime string from Open-Meteo (in the location's TZ) as "H:MM AM/PM". */
function formatLocationTime(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const [h, m] = raw.slice(11, 16).split(':').map(Number);
  if (h == null || m == null) return null;
  const suffix = h < 12 ? 'AM' : 'PM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Extracts today's sunset time and formats it for display (e.g. "6:15 PM"). */
function parseSunset(data: OpenMeteoData): string | null {
  return formatLocationTime(data.daily.sunset?.[0]);
}

/** Extracts today's sunrise time and formats it for display. */
function parseSunrise(data: OpenMeteoData): string | null {
  return formatLocationTime(data.daily.sunrise?.[0]);
}

/** Returns sunrise/sunset as hour numbers for daylight comparison. */
function parseDaylightHours(data: OpenMeteoData): DaylightHours | null {
  const sunrise = data.daily.sunrise?.[0];
  const sunset = data.daily.sunset?.[0];
  if (!sunrise || !sunset) return null;
  // Open-Meteo (timezone=auto) returns these as naive strings in the forecast
  // location's timezone. Parse the hour from the string directly so the value
  // matches hourly.time hours rather than shifting by the browser's TZ offset.
  return {
    sunriseHour: Number.parseInt(sunrise.slice(11, 13), 10),
    sunsetHour: Number.parseInt(sunset.slice(11, 13), 10),
  };
}

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

/**
 * Assembles the unified weather object used by the UI from a raw Open-Meteo
 * payload, rating conditions against the given thresholds. Secondary
 * enrichments (AQI, alerts) arrive later.
 */
export function buildWeatherFromData(data: OpenMeteoData, thresholds: Thresholds): Weather {
  if (!data.current) throw new Error('Weather API missing current data');

  // Align with the forecast location's timezone rather than the browser's local timezone.
  const currentHourStr = toHourlyTimeKey(data.current.time) ?? currentHourStrForLocation(data);
  const hourIdx = data.hourly.time.indexOf(currentHourStr);
  const currentRainChance =
    hourIdx === -1 ? 0 : (data.hourly.precipitation_probability[hourIdx] ?? 0);

  const hourlyParsed = parseHourly(data, currentHourStr, thresholds);

  return {
    temperature: data.current.temperature_2m,
    feelsLike: data.current.apparent_temperature,
    windSpeed: data.current.wind_speed_10m,
    windGust: data.current.wind_gusts_10m ?? null,
    windDirection: data.current.wind_direction_10m,
    rainChance: currentRainChance,
    weatherCode: data.current.weather_code,
    hasThunderstorms: isThunderstorm(data.current.weather_code),
    condition: getWeatherDescription(data.current.weather_code),
    dewpoint: data.current.dewpoint_2m,
    aqi: null,
    uvIndex: hourIdx === -1 ? null : (data.hourly.uv_index?.[hourIdx] ?? null),
    uvIndexDailyMax: data.daily.uv_index_max?.[0] ?? null,
    hourly: hourlyParsed,
    pastHourly: parsePastHourly(data, currentHourStr, 12, thresholds),
    daily: parseDaily(data, thresholds),
    sunrise: parseSunrise(data),
    sunset: parseSunset(data),
    daylight: parseDaylightHours(data),
    nwsAlerts: [],
  };
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

export { REQUEST_TIMEOUT_ERROR } from './http';
