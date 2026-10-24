import {
  getWeatherDescription,
  isThunderstorm,
  getHourlyCondition,
  getDailyCondition,
} from '../domain/weather';
import {
  selectBestRideWindows,
  type DailyRideWindow,
  type RideWindowHour,
} from '../domain/ride-window';
import type { Thresholds } from '../domain/constants';
import { normalizePercent } from '../utils/percent';

import type { DailyWeather, DaylightHour, HourlyWeather, Weather } from '@/types/weather';

interface DaylightHours {
  sunriseHour: number;
  sunsetHour: number;
}

interface TempRange {
  min: number;
  max: number;
}

interface DailyParseContext {
  data: OpenMeteoData;
  currentDate: string;
  daytimeTempByDate: Record<string, TempRange>;
  dewpointByDate: Record<string, number>;
  bestRideWindows: Record<string, DailyRideWindow>;
  daylightRatings: Record<string, DaylightHour[]>;
  thresholds: Thresholds;
}

interface OpenMeteoHourly {
  time: string[];
  temperature_2m: number[];
  apparent_temperature: number[];
  wind_speed_10m: number[];
  wind_gusts_10m?: (number | null)[];
  precipitation_probability: number[];
  /** Expected amount per hour, mm. Optional: older cached payloads lack it. */
  precipitation?: (number | null)[];
  weather_code: number[];
  /** Null where a source omits it (WeatherKit REST marks it optional). */
  dewpoint_2m: (number | null)[];
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
  const precip = data.hourly.precipitation?.[idx] ?? null;
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
    precipitation: precip,
    dewpoint,
    weatherCode: code,
    uv,
    condition: getHourlyCondition(
      { temperature, wind, gust, rain, precip, code, dewpoint },
      thresholds,
    ),
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
 * Converts a naive ISO datetime ("YYYY-MM-DDTHH:MM") to its nearest whole clock
 * hour, rounding up at :30 so a 5:55 PM sunset includes the 5–6 PM hour.
 */
function roundClockHour(iso: string): number {
  const hour = Number.parseInt(iso.slice(11, 13), 10);
  const minute = Number.parseInt(iso.slice(14, 16), 10);
  return Number.isNaN(minute) || minute < 30 ? hour : hour + 1;
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
        sunriseHour: roundClockHour(sr),
        sunsetHour: roundClockHour(ss),
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

/**
 * Each date's daylight hours, rated like the hourly chart's hours (same record
 * builder, same thresholds), for the week list's daylight strip. A date whose
 * forecast stops before sunset gets none, since its strip would end
 * mid-afternoon; today's hours from before the forecast's first hour stay in
 * as unrated past hours, so today's strip still spans the whole day. A date
 * that is all past (today, after sunset) gets none either.
 */
function buildDaylightRatings(
  data: OpenMeteoData,
  daylightByDate: Record<string, DaylightHours>,
  currentHourKey: string,
  thresholds: Thresholds,
): Record<string, DaylightHour[]> {
  const indexByTime = new Map(data.hourly.time.map((time, i) => [time, i]));
  const ratings: Record<string, DaylightHour[]> = {};
  for (const [date, { sunriseHour, sunsetHour }] of Object.entries(daylightByDate)) {
    const hours: DaylightHour[] = [];
    for (let hour = sunriseHour; hour < sunsetHour; hour++) {
      const time = `${date}T${pad2(hour)}:00`;
      const isPast = time < currentHourKey;
      const idx = indexByTime.get(time);
      const record = idx == null ? null : buildHourRecord(data, idx, thresholds);
      if (record == null && !isPast) break;
      hours.push({ hour, condition: record?.condition ?? null, ...(isPast && { isPast }) });
    }
    const complete = hours.length === sunsetHour - sunriseHour;
    if (complete && hours.some((h) => !h.isPast)) ratings[date] = hours;
  }
  return ratings;
}

/** Groups the remaining daylight hours by date and picks each date's best ride window. */
function buildBestRideWindows(
  data: OpenMeteoData,
  daylightByDate: Record<string, DaylightHours>,
  thresholds: Thresholds,
  rideWindowHours?: number,
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
      precipitation: data.hourly.precipitation?.[i] ?? null,
      dewpoint: data.hourly.dewpoint_2m[i] ?? null,
      weatherCode: data.hourly.weather_code[i] ?? null,
      uv: data.hourly.uv_index?.[i] ?? null,
    });
    hoursByDate[date] = dateHours;
  }

  return selectBestRideWindows(
    hoursByDate,
    currentHourKey.slice(0, 10),
    thresholds,
    rideWindowHours,
  );
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
    precipitation: window.precipitation,
    uvMax: window.uvMax,
    weatherCode: window.weatherCode,
    condition: window.condition,
  };
}

function buildDailyWeather(
  context: DailyParseContext,
  dateStr: string,
  index: number,
): DailyWeather | null {
  const fallback = buildFallbackDailyWeather(context, dateStr, index);
  if (!fallback) return null;
  const daylight = context.daylightRatings[dateStr];
  const day = daylight ? { ...fallback, daylight } : fallback;
  const rideWindow = context.bestRideWindows[dateStr];
  if (rideWindow) return applyRideWindow(day, rideWindow);
  return dateStr === context.currentDate ? { ...day, rideWindowUnavailable: true } : day;
}

/** Parses the 8-day daily forecast into a simplified array with cycling conditions. */
function parseDaily(
  data: OpenMeteoData,
  thresholds: Thresholds,
  rideWindowHours?: number,
): DailyWeather[] {
  const currentHourKey = toHourlyTimeKey(data.current?.time) ?? currentHourStrForLocation(data);
  const currentDate = currentHourKey.slice(0, 10);
  const daylightByDate = buildDaylightByDate(data);
  const { dewpointByDate, daytimeTempByDate } = buildDaytimeAggregates(data, daylightByDate);
  const bestRideWindows = buildBestRideWindows(data, daylightByDate, thresholds, rideWindowHours);
  const context: DailyParseContext = {
    data,
    currentDate,
    daytimeTempByDate,
    dewpointByDate,
    bestRideWindows,
    daylightRatings: buildDaylightRatings(data, daylightByDate, currentHourKey, thresholds),
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
    sunriseHour: roundClockHour(sunrise),
    sunsetHour: roundClockHour(sunset),
  };
}

/**
 * Reconciles the "Now" hour with the current observation. The hourly forecast
 * row for the current hour is model output while `current` is a real
 * observation (WeatherKit especially), so left unmerged the chart's Now row
 * can contradict the verdict and Numbers card, which both read `current`.
 * Rain chance and UV stay with the hourly row — the observation has no
 * precipitation probability — and the merged hour is re-rated.
 */
function mergeNowObservation(
  hourly: HourlyWeather[],
  current: NonNullable<OpenMeteoData['current']>,
  hourIdx: number,
  thresholds: Thresholds,
): HourlyWeather[] {
  const now = hourly[0];
  if (hourIdx === -1 || !now) return hourly;
  const windGust = current.wind_gusts_10m ?? now.windGust;
  const merged: HourlyWeather = {
    ...now,
    temperature: current.temperature_2m,
    feelsLike: current.apparent_temperature,
    windSpeed: current.wind_speed_10m,
    windGust,
    dewpoint: current.dewpoint_2m,
    weatherCode: current.weather_code,
    condition: getHourlyCondition(
      {
        temperature: current.temperature_2m,
        wind: current.wind_speed_10m,
        gust: windGust,
        rain: now.rainChance,
        precip: now.precipitation,
        code: current.weather_code,
        dewpoint: current.dewpoint_2m,
      },
      thresholds,
    ),
  };
  return [merged, ...hourly.slice(1)];
}

/** The daily series from `start` on, every array cut alike. */
function dailyFrom(daily: OpenMeteoDaily, start: number): OpenMeteoDaily {
  if (start <= 0) return daily;
  return Object.fromEntries(
    Object.entries(daily).map(([key, values]) => [key, (values as unknown[]).slice(start)]),
  ) as unknown as OpenMeteoDaily;
}

/**
 * The payload as it reads `hoursAhead` hours after it was fetched: that hour's
 * forecast stands in for the observation, so `buildWeatherFromData` rates it
 * as "now", with today's ride window chosen from the hours still left then.
 * Past midnight, the days already over are dropped, so the new date reads as
 * today rather than tomorrow.
 * The home screen widget steps through these, since it can't fetch or rate a
 * forecast itself. Null when the hourly data doesn't reach that far.
 */
export function forecastFromHour(data: OpenMeteoData, hoursAhead: number): OpenMeteoData | null {
  const { current, hourly } = data;
  if (!current) return null;
  const nowIdx = hourly.time.indexOf(
    toHourlyTimeKey(current.time) ?? currentHourStrForLocation(data),
  );
  if (nowIdx === -1) return null;
  const i = nowIdx + hoursAhead;
  const time = hourly.time[i];
  const temperature = hourly.temperature_2m[i];
  const feelsLike = hourly.apparent_temperature[i];
  const wind = hourly.wind_speed_10m[i];
  const code = hourly.weather_code[i];
  if (time == null || temperature == null || feelsLike == null || wind == null || code == null) {
    return null;
  }
  const today = time.slice(0, 10);
  const firstDay = data.daily.time.findIndex((date) => date >= today);
  return {
    ...data,
    daily: dailyFrom(data.daily, firstDay === -1 ? data.daily.time.length : firstDay),
    current: {
      time,
      temperature_2m: temperature,
      apparent_temperature: feelsLike,
      wind_speed_10m: wind,
      wind_gusts_10m: hourly.wind_gusts_10m?.[i] ?? null,
      // A source may omit an hour's dewpoint; the observation's is the nearest reading.
      dewpoint_2m: hourly.dewpoint_2m[i] ?? current.dewpoint_2m,
      weather_code: code,
      // Hourly forecasts carry no wind direction.
      wind_direction_10m: null,
    },
  };
}

/**
 * Assembles the unified weather object used by the UI from a raw Open-Meteo
 * (or WeatherKit, reshaped by weatherService.ios.ts) payload, rating conditions
 * against the given thresholds. Secondary enrichments (AQI, alerts) arrive later.
 */
export function buildWeatherFromData(
  data: OpenMeteoData,
  thresholds: Thresholds,
  rideWindowHours?: number,
): Weather {
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
    precipitation: hourIdx === -1 ? null : (data.hourly.precipitation?.[hourIdx] ?? null),
    weatherCode: data.current.weather_code,
    hasThunderstorms: isThunderstorm(data.current.weather_code),
    condition: getWeatherDescription(data.current.weather_code),
    dewpoint: data.current.dewpoint_2m,
    aqi: null,
    uvIndex: hourIdx === -1 ? null : (data.hourly.uv_index?.[hourIdx] ?? null),
    uvIndexDailyMax: data.daily.uv_index_max?.[0] ?? null,
    hourly: mergeNowObservation(hourlyParsed, data.current, hourIdx, thresholds),
    pastHourly: parsePastHourly(data, currentHourStr, 12, thresholds),
    daily: parseDaily(data, thresholds, rideWindowHours),
    sunrise: parseSunrise(data),
    sunset: parseSunset(data),
    daylight: parseDaylightHours(data),
    nwsAlerts: [],
  };
}
