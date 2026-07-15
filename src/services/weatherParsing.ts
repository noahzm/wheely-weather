import {
  getWeatherDescription,
  getWeatherCodeCondition,
  isThunderstorm,
  getHourlyCondition,
  getDailyCondition,
} from '../domain/weather';
import { RANK } from '../domain/scoring';
import type { Thresholds } from '../domain/constants';
import { fetchWithTimeout } from './http';
import { normalizePercent } from '../utils/percent';

import type { DailyWeather, HourlyWeather, Weather, WeatherAlert } from '@/types/weather';

interface DaylightHours {
  sunriseHour: number;
  sunsetHour: number;
}

interface TempRange {
  min: number;
  max: number;
}

interface DailyRideWindow {
  startHour: number;
  endHour: number;
  tempLow: number;
  tempHigh: number;
  windSpeed: number;
  windGust: number | null;
  rainChance: number;
  dewpoint: number | null;
  weatherCode: number | null;
  condition: DailyWeather['condition'];
}

interface RideWindowHour {
  hour: number;
  temperature: number;
  windSpeed: number;
  windGust: number | null;
  rainChance: number;
  dewpoint: number | null;
  weatherCode: number | null;
}

interface DailyParseContext {
  data: OpenMeteoData;
  currentDate: string;
  daytimeTempByDate: Record<string, TempRange>;
  dewpointByDate: Record<string, number>;
  bestRideWindows: Record<string, DailyRideWindow>;
  thresholds: Thresholds;
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

// Keep secondary lookups snappy so slower third-party APIs do not hold up first paint.
// Shared by both the Open-Meteo (weatherService.ts) and WeatherKit (weatherService.ios.ts)
// fetch implementations.
export const SECONDARY_FETCH_TIMEOUT_MS = 2500;
// WeatherKit's first call on a fresh install involves authentication token
// negotiation with Apple's servers plus a CLGeocoder reverse-geocode for
// timezone resolution — easily 10-15 s, so the old 8 s ceiling timed out
// before the data could arrive (TestFlight "Can't connect" symptom).
export const FORECAST_FETCH_TIMEOUT_MS = 20_000;

/** Normalizes a forecast timestamp down to the hourly format used by hourly.time. */
function toHourlyTimeKey(timeStr: string | null | undefined): string | null {
  if (!timeStr) return null;
  return `${timeStr.slice(0, 13)}:00`;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

const normalizeRainChance = (value: number | null | undefined): number =>
  normalizePercent(value ?? 0);

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
  const rain = normalizeRainChance(data.hourly.precipitation_probability[idx]);
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

const DAILY_RIDE_WINDOW_HOURS = 3;

function getWorstWeatherCode(codes: (number | null)[]): number | null {
  let worstCode: number | null = null;
  let worstRank = Infinity;
  for (const code of codes) {
    if (code == null) continue;
    const rank = RANK[getWeatherCodeCondition(code)];
    if (rank < worstRank) {
      worstCode = code;
      worstRank = rank;
    }
  }
  return worstCode;
}

function scoreRideWindow(window: DailyRideWindow): number {
  const avgTemp = (window.tempLow + window.tempHigh) / 2;
  const gust = window.windGust ?? window.windSpeed;
  return (
    RANK[window.condition] * 1000 -
    window.rainChance * 2 -
    window.windSpeed * 3 -
    gust +
    Math.max(0, 20 - Math.abs(avgTemp - 68))
  );
}

function buildRideWindowCandidate(
  hours: RideWindowHour[],
  thresholds: Thresholds,
): DailyRideWindow | null {
  if (hours.length !== DAILY_RIDE_WINDOW_HOURS) return null;
  const first = hours[0];
  const last = hours.at(-1);
  if (!first || !last) return null;
  if (last.hour - first.hour !== hours.length - 1) return null;

  const temperatures = hours.map((hour) => hour.temperature);
  const windSpeed = Math.max(...hours.map((hour) => hour.windSpeed));
  const gusts = hours.map((hour) => hour.windGust).filter((gust): gust is number => gust != null);
  const windGust = gusts.length > 0 ? Math.max(...gusts) : null;
  const rainChance = Math.max(...hours.map((hour) => hour.rainChance));
  const dewpoints = hours
    .map((hour) => hour.dewpoint)
    .filter((dewpoint): dewpoint is number => dewpoint != null);
  const dewpoint = dewpoints.length > 0 ? Math.max(...dewpoints) : null;
  const weatherCode = getWorstWeatherCode(hours.map((hour) => hour.weatherCode));
  const tempLow = Math.min(...temperatures);
  const tempHigh = Math.max(...temperatures);

  return {
    startHour: first.hour,
    endHour: last.hour + 1,
    tempLow,
    tempHigh,
    windSpeed,
    windGust,
    rainChance,
    dewpoint,
    weatherCode,
    condition: getDailyCondition(
      {
        tempLow,
        tempHigh,
        wind: windSpeed,
        gust: windGust,
        rain: rainChance,
        code: weatherCode,
        dewpoint,
      },
      thresholds,
    ),
  };
}

function selectBestRideWindow(
  hours: RideWindowHour[],
  thresholds: Thresholds,
): DailyRideWindow | null {
  if (hours.length < DAILY_RIDE_WINDOW_HOURS) return null;

  let best: DailyRideWindow | null = null;
  let bestScore = -Infinity;
  for (let start = 0; start <= hours.length - DAILY_RIDE_WINDOW_HOURS; start++) {
    const candidate = buildRideWindowCandidate(
      hours.slice(start, start + DAILY_RIDE_WINDOW_HOURS),
      thresholds,
    );
    if (!candidate) continue;
    const score = scoreRideWindow(candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Finds each date's best contiguous three-hour daylight window. Metrics within
 * a candidate stay worst-case so its rating remains honest, but a brief rough
 * hour no longer condemns an otherwise rideable day.
 */
function buildBestRideWindows(
  data: OpenMeteoData,
  daylightByDate: Record<string, DaylightHours>,
  thresholds: Thresholds,
): Record<string, DailyRideWindow> {
  const hoursByDate: Record<string, RideWindowHour[]> = {};
  const currentHourKey = toHourlyTimeKey(data.current?.time) ?? currentHourStrForLocation(data);

  for (const [i, time] of data.hourly.time.entries()) {
    if (time < currentHourKey) continue;
    const date = time.slice(0, 10);
    const daylight = daylightByDate[date];
    const hour = Number.parseInt(time.slice(11, 13), 10);
    if (!daylight || hour < daylight.sunriseHour || hour >= daylight.sunsetHour) continue;

    const temperature = data.hourly.temperature_2m[i];
    const windSpeed = data.hourly.wind_speed_10m[i];
    const rainChanceRaw = data.hourly.precipitation_probability[i];
    if (temperature == null || windSpeed == null || rainChanceRaw == null) continue;

    const dateHours = hoursByDate[date] ?? [];
    dateHours.push({
      hour,
      temperature,
      windSpeed,
      windGust: data.hourly.wind_gusts_10m?.[i] ?? null,
      rainChance: normalizeRainChance(rainChanceRaw),
      dewpoint: data.hourly.dewpoint_2m[i] ?? null,
      weatherCode: data.hourly.weather_code[i] ?? null,
    });
    hoursByDate[date] = dateHours;
  }

  const bestByDate: Record<string, DailyRideWindow> = {};
  for (const [date, hours] of Object.entries(hoursByDate)) {
    const best = selectBestRideWindow(hours, thresholds);
    if (best) bestByDate[date] = best;
  }

  return bestByDate;
}

function buildFallbackDailyWeather(
  context: DailyParseContext,
  dateStr: string,
  index: number,
): DailyWeather | null {
  const { data, daytimeTempByDate, dewpointByDate, thresholds } = context;
  const high = data.daily.temperature_2m_max[index];
  const low = data.daily.temperature_2m_min[index];
  const windSpeed = data.daily.wind_speed_10m_max[index];
  const rainChanceRaw = data.daily.precipitation_probability_max[index];
  if (high == null || low == null || windSpeed == null || rainChanceRaw == null) return null;
  const daytime = daytimeTempByDate[dateStr];
  const tempLow = daytime?.min ?? low;
  const tempHigh = daytime?.max ?? high;
  const gust = data.daily.wind_gusts_10m_max?.[index] ?? null;
  const code = data.daily.weather_code[index] ?? null;
  const dewpoint = dewpointByDate[dateStr] ?? null;
  const fallbackRainChance = normalizeRainChance(rainChanceRaw);
  const fallbackCondition = getDailyCondition(
    {
      tempLow,
      tempHigh,
      wind: windSpeed,
      gust,
      rain: fallbackRainChance,
      code,
      dewpoint,
    },
    thresholds,
  );

  return {
    date: new Date(dateStr + 'T12:00:00'),
    high: Math.round(high),
    low: Math.round(low),
    feelsLike: data.daily.apparent_temperature_max[index] ?? null,
    dewpoint,
    windSpeed,
    windGust: gust,
    rainChance: fallbackRainChance,
    weatherCode: code,
    condition: fallbackCondition,
  };
}

function applyRideWindow(day: DailyWeather, window: DailyRideWindow): DailyWeather {
  return {
    ...day,
    rideWindow: {
      startHour: window.startHour,
      endHour: window.endHour,
      tempLow: window.tempLow,
      tempHigh: window.tempHigh,
    },
    dewpoint: window.dewpoint,
    windSpeed: window.windSpeed,
    windGust: window.windGust,
    rainChance: window.rainChance,
    weatherCode: window.weatherCode,
    condition: window.condition,
  };
}

function buildDailyWeather(
  context: DailyParseContext,
  dateStr: string,
  index: number,
): DailyWeather | null {
  const day = buildFallbackDailyWeather(context, dateStr, index);
  if (!day) return null;
  const rideWindow = context.bestRideWindows[dateStr];
  if (rideWindow) return applyRideWindow(day, rideWindow);
  return dateStr === context.currentDate ? { ...day, rideWindowUnavailable: true } : day;
}

/** Parses the 8-day daily forecast into a simplified array with cycling conditions. */
function parseDaily(data: OpenMeteoData, thresholds: Thresholds): DailyWeather[] {
  const currentDate = (
    toHourlyTimeKey(data.current?.time) ?? currentHourStrForLocation(data)
  ).slice(0, 10);
  const daylightByDate = buildDaylightByDate(data);
  const { dewpointByDate, daytimeTempByDate } = buildDaytimeAggregates(data, daylightByDate);
  const bestRideWindows = buildBestRideWindows(data, daylightByDate, thresholds);
  const context: DailyParseContext = {
    data,
    currentDate,
    daytimeTempByDate,
    dewpointByDate,
    bestRideWindows,
    thresholds,
  };

  return data.daily.time
    .map((dateStr, index) => buildDailyWeather(context, dateStr, index))
    .filter((day): day is DailyWeather => day !== null);
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

/**
 * Assembles the unified weather object used by the UI from a raw Open-Meteo
 * (or WeatherKit, reshaped by weatherService.ios.ts) payload, rating conditions
 * against the given thresholds. Secondary enrichments (AQI, alerts) arrive later.
 */
export function buildWeatherFromData(data: OpenMeteoData, thresholds: Thresholds): Weather {
  if (!data.current) throw new Error('Weather API missing current data');

  // Align with the forecast location's timezone rather than the browser's local timezone.
  const currentHourStr = toHourlyTimeKey(data.current.time) ?? currentHourStrForLocation(data);
  const hourIdx = data.hourly.time.indexOf(currentHourStr);
  const currentRainChance =
    hourIdx === -1 ? 0 : normalizeRainChance(data.hourly.precipitation_probability[hourIdx]);

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
