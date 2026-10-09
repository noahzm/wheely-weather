// WeatherKit REST forecasts for the web app, reshaped into the Open-Meteo wire
// format (`OpenMeteoData`) that `buildWeatherFromData` already parses, so web
// rates the same forecast as iOS (whose native module does the same reshape in
// modules/apple-weatherkit). Signing needs an Apple Developer WeatherKit key;
// the four WEATHERKIT_* values are Worker secrets.
import tzLookup from '@photostructure/tz-lookup';

import { weatherKitConditionToWmoCode } from '../src/domain/weatherkit-codes';
import type { OpenMeteoData } from '../src/services/weatherParsing';

export interface WeatherKitSecrets {
  WEATHERKIT_TEAM_ID?: string;
  WEATHERKIT_SERVICE_ID?: string;
  WEATHERKIT_KEY_ID?: string;
  /** The .p8 key's PEM text, header lines included. */
  WEATHERKIT_PRIVATE_KEY?: string;
}

type Credentials = Required<WeatherKitSecrets>;

const WEATHERKIT_API = 'https://weatherkit.apple.com/api/v1/weather/en';
// Match the Open-Meteo request: 12 past hours, eight forecast days.
const PAST_HOURS = 12;
const FORECAST_DAYS = 8;
const HOUR_MS = 3_600_000;
// Apple caps token lifetime; renew well before expiry.
const TOKEN_LIFETIME_S = 3600;
const TOKEN_RENEW_MARGIN_S = 300;

interface RestCurrent {
  asOf: string;
  temperature: number;
  temperatureApparent: number;
  temperatureDewPoint: number;
  windSpeed: number;
  windGust?: number;
  windDirection?: number;
  conditionCode: string;
}

interface RestHour {
  forecastStart: string;
  temperature: number;
  temperatureApparent: number;
  temperatureDewPoint?: number;
  windSpeed: number;
  windGust?: number;
  precipitationChance: number;
  precipitationAmount?: number;
  conditionCode: string;
  uvIndex: number;
}

interface RestDay {
  forecastStart: string;
  sunrise?: string;
  sunset?: string;
  temperatureMax: number;
  temperatureMin: number;
  precipitationChance: number;
  conditionCode: string;
  maxUvIndex: number;
  // Live responses carry these, though Apple's reference omits them.
  windSpeedMax?: number;
  windGustSpeedMax?: number;
  daytimeForecast?: { windSpeed?: number };
}

export interface WeatherKitRestResponse {
  currentWeather?: RestCurrent;
  forecastHourly?: { hours: RestHour[] };
  forecastDaily?: { days: RestDay[] };
}

/**
 * REST condition codes are an older vocabulary than the Swift
 * `WeatherCondition` enum that weatherkit-codes.ts maps. Codes not listed here
 * share the Swift name with a capital first letter (`MostlyClear`).
 */
const REST_TO_SWIFT_CONDITION: Record<string, string> = {
  Dust: 'blowingDust',
  Fog: 'foggy',
  Smoke: 'smoky',
  Showers: 'rain',
  ScatteredShowers: 'sunShowers',
  ScatteredSnowShowers: 'flurries',
  SnowShowers: 'snow',
  MixedRainAndSleet: 'sleet',
  MixedRainAndSnow: 'wintryMix',
  MixedSnowAndSleet: 'wintryMix',
  MixedRainfall: 'rain',
  Thunderstorm: 'thunderstorms',
  SevereThunderstorm: 'strongStorms',
  Tornado: 'strongStorms',
};

export function restConditionToWmoCode(code: string): number {
  const swift = REST_TO_SWIFT_CONDITION[code] ?? code.charAt(0).toLowerCase() + code.slice(1);
  return weatherKitConditionToWmoCode(swift);
}

export function hasWeatherKitCredentials(env: WeatherKitSecrets): env is Credentials {
  return Boolean(
    env.WEATHERKIT_TEAM_ID &&
    env.WEATHERKIT_SERVICE_ID &&
    env.WEATHERKIT_KEY_ID &&
    env.WEATHERKIT_PRIVATE_KEY,
  );
}

const celsiusToF = (c: number) => (c * 9) / 5 + 32;
const kmhToMph = (kmh: number) => kmh / 1.609344;

/**
 * Formats instants as the naive local-time strings Open-Meteo's
 * `timezone=auto` returns (`2026-10-11T07:00`), which the parser keys on.
 */
function makeLocalFormatter(timeZone: string) {
  const format = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const dateTime = (iso: string): string => {
    const parts: Record<string, string> = {};
    for (const part of format.formatToParts(new Date(iso))) parts[part.type] = part.value;
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  };
  return { dateTime, date: (iso: string) => dateTime(iso).slice(0, 10) };
}

/** The zone's current offset from UTC, in seconds. */
export function utcOffsetSeconds(timeZone: string, now: Date): number {
  const local = makeLocalFormatter(timeZone).dateTime(now.toISOString());
  const asUtc = Date.parse(`${local}:00Z`);
  const nowToMinute = Math.floor(now.getTime() / 60_000) * 60_000;
  return Math.round((asUtc - nowToMinute) / 1000);
}

export function toOpenMeteoData(
  response: WeatherKitRestResponse,
  timeZone: string,
  now: Date,
): OpenMeteoData {
  const { currentWeather: current, forecastHourly, forecastDaily } = response;
  if (!current || !forecastHourly || !forecastDaily) {
    throw new Error('WeatherKit response missing a data set');
  }
  const local = makeLocalFormatter(timeZone);
  const hours = forecastHourly.hours;
  // WeatherKit rolls daily forecasts up in the requested zone; clip to the
  // eight days Open-Meteo returns so both sources list the same week.
  const days = forecastDaily.days.slice(0, FORECAST_DAYS);

  return {
    utc_offset_seconds: utcOffsetSeconds(timeZone, now),
    current: {
      time: local.dateTime(current.asOf),
      temperature_2m: celsiusToF(current.temperature),
      apparent_temperature: celsiusToF(current.temperatureApparent),
      wind_speed_10m: kmhToMph(current.windSpeed),
      wind_gusts_10m: current.windGust == null ? null : kmhToMph(current.windGust),
      dewpoint_2m: celsiusToF(current.temperatureDewPoint),
      weather_code: restConditionToWmoCode(current.conditionCode),
      wind_direction_10m: current.windDirection ?? null,
    },
    hourly: {
      time: hours.map((h) => local.dateTime(h.forecastStart)),
      temperature_2m: hours.map((h) => celsiusToF(h.temperature)),
      apparent_temperature: hours.map((h) => celsiusToF(h.temperatureApparent)),
      wind_speed_10m: hours.map((h) => kmhToMph(h.windSpeed)),
      wind_gusts_10m: hours.map((h) => (h.windGust == null ? null : kmhToMph(h.windGust))),
      precipitation_probability: hours.map((h) => Math.round(h.precipitationChance * 100)),
      precipitation: hours.map((h) => h.precipitationAmount ?? null),
      weather_code: hours.map((h) => restConditionToWmoCode(h.conditionCode)),
      dewpoint_2m: hours.map((h) =>
        h.temperatureDewPoint == null ? null : celsiusToF(h.temperatureDewPoint),
      ),
      uv_index: hours.map((h) => h.uvIndex),
    },
    daily: {
      time: days.map((d) => local.date(d.forecastStart)),
      sunrise: days.map((d) => (d.sunrise ? local.dateTime(d.sunrise) : '')),
      sunset: days.map((d) => (d.sunset ? local.dateTime(d.sunset) : '')),
      // No daily "feels like" high, as on iOS: use the actual high.
      apparent_temperature_max: days.map((d) => celsiusToF(d.temperatureMax)),
      temperature_2m_max: days.map((d) => celsiusToF(d.temperatureMax)),
      temperature_2m_min: days.map((d) => celsiusToF(d.temperatureMin)),
      wind_speed_10m_max: days.map((d) =>
        kmhToMph(d.windSpeedMax ?? d.daytimeForecast?.windSpeed ?? 0),
      ),
      wind_gusts_10m_max: days.map((d) =>
        d.windGustSpeedMax == null ? null : kmhToMph(d.windGustSpeedMax),
      ),
      precipitation_probability_max: days.map((d) => Math.round(d.precipitationChance * 100)),
      weather_code: days.map((d) => restConditionToWmoCode(d.conditionCode)),
      uv_index_max: days.map((d) => d.maxUvIndex),
    },
  };
}

function base64Url(bytes: Uint8Array | string): string {
  const binary =
    typeof bytes === 'string' ? bytes : Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function pemToDer(pem: string): Uint8Array<ArrayBuffer> {
  const body = pem
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '')
    // Dashboard-pasted secrets sometimes carry literal "\n" escapes.
    .replaceAll('\\n', '')
    .replace(/\s+/g, '');
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
}

let cachedToken: { value: string; expiresAt: number } | null = null;

/** Signs the ES256 developer token WeatherKit's REST API requires. */
export async function weatherKitToken(env: Credentials, nowMs: number): Promise<string> {
  const nowS = Math.floor(nowMs / 1000);
  if (cachedToken && cachedToken.expiresAt - TOKEN_RENEW_MARGIN_S > nowS) {
    return cachedToken.value;
  }
  const header = {
    alg: 'ES256',
    kid: env.WEATHERKIT_KEY_ID,
    id: `${env.WEATHERKIT_TEAM_ID}.${env.WEATHERKIT_SERVICE_ID}`,
  };
  const expiresAt = nowS + TOKEN_LIFETIME_S;
  const payload = {
    iss: env.WEATHERKIT_TEAM_ID,
    sub: env.WEATHERKIT_SERVICE_ID,
    iat: nowS,
    exp: expiresAt,
  };
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(env.WEATHERKIT_PRIVATE_KEY),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  // WebCrypto emits the raw r||s signature JWS expects (not DER).
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput),
  );
  const value = `${signingInput}.${base64Url(new Uint8Array(signature))}`;
  cachedToken = { value, expiresAt };
  return value;
}

/** Test hook: forget the cached token. */
export function resetWeatherKitToken(): void {
  cachedToken = null;
}

export function weatherKitUrl(lat: number, lon: number, timeZone: string, now: Date): string {
  const hourStart = Math.floor(now.getTime() / HOUR_MS) * HOUR_MS;
  const params = new URLSearchParams({
    dataSets: 'currentWeather,forecastHourly,forecastDaily',
    timezone: timeZone,
    hourlyStart: new Date(hourStart - PAST_HOURS * HOUR_MS).toISOString(),
    hourlyEnd: new Date(hourStart + (FORECAST_DAYS * 24 + 1) * HOUR_MS).toISOString(),
  });
  return `${WEATHERKIT_API}/${lat}/${lon}?${params.toString()}`;
}

/** Fetches and reshapes a WeatherKit forecast; throws on any failure. */
export async function fetchWeatherKitForecast(
  env: Credentials,
  lat: number,
  lon: number,
  now: Date = new Date(),
): Promise<OpenMeteoData> {
  const timeZone = tzLookup(lat, lon);
  const token = await weatherKitToken(env, now.getTime());
  const res = await fetch(weatherKitUrl(lat, lon, timeZone, now), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`WeatherKit ${res.status}`);
  const body = (await res.json()) as WeatherKitRestResponse;
  return toOpenMeteoData(body, timeZone, now);
}
