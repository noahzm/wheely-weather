import {
  getWeatherDescription,
  isThunderstorm,
  getHourlyCondition,
  getDailyCondition,
} from "../domain/weather";
import {
  getMockScenario,
  buildMockWeather,
} from "./mockWeather";
import { fetchWithTimeout, REQUEST_TIMEOUT_ERROR } from "./http";

/** @typedef {import('@/types/weather').ForecastExtras} ForecastExtras */
/** @typedef {import('@/types/weather').HourlyWeather} HourlyWeather */
/** @typedef {import('@/types/weather').DailyWeather} DailyWeather */
/** @typedef {import('@/types/weather').MockScenario} MockScenario */
/** @typedef {import('@/types/weather').Weather} Weather */
/** @typedef {import('@/types/weather').WeatherAlert} WeatherAlert */
/** @typedef {{ mockScenario?: MockScenario | string | null }} WeatherRequestOptions */
/** @typedef {{ sunriseHour: number; sunsetHour: number }} DaylightHours */
/** @typedef {{ min: number; max: number }} TempRange */
/**
 * @typedef {{
 *   time: string[];
 *   apparent_temperature: number[];
 *   wind_speed_10m: number[];
 *   wind_gusts_10m?: (number | null)[];
 *   precipitation_probability: number[];
 *   weather_code: number[];
 *   dewpoint_2m: number[];
 *   uv_index?: (number | null)[];
 * }} OpenMeteoHourly
 */
/**
 * @typedef {{
 *   time: string[];
 *   sunrise?: string[];
 *   sunset?: string[];
 *   apparent_temperature_max: number[];
 *   temperature_2m_max: number[];
 *   temperature_2m_min: number[];
 *   wind_speed_10m_max: number[];
 *   wind_gusts_10m_max?: (number | null)[];
 *   precipitation_probability_max: number[];
 *   weather_code: number[];
 *   uv_index_max?: (number | null)[];
 * }} OpenMeteoDaily
 */
/**
 * @typedef {{
 *   utc_offset_seconds?: number;
 *   current?: {
 *     time?: string;
 *     apparent_temperature: number;
 *     wind_speed_10m: number;
 *     wind_gusts_10m?: number | null;
 *     dewpoint_2m: number;
 *     weather_code: number;
 *     wind_direction_10m?: number | null;
 *   };
 *   hourly: OpenMeteoHourly;
 *   daily: OpenMeteoDaily;
 * }} OpenMeteoData
 */
/** @typedef {{ properties: { severity?: string; event?: string; headline?: string; description?: string; instruction?: string; expires?: string } }} NwsFeature */

// Fallback coordinates used when geolocation is unavailable or denied.
export const DEFAULT_LAT = 35.7796;
export const DEFAULT_LON = -78.6382;
export const DEFAULT_LOCATION = "Raleigh, NC";

// Keep secondary lookups snappy so slower third-party APIs do not hold up first paint.
const SECONDARY_FETCH_TIMEOUT_MS = 2500;
const FORECAST_FETCH_TIMEOUT_MS = 8000;
export { REQUEST_TIMEOUT_ERROR };

/** Normalizes a forecast timestamp down to the hourly format used by hourly.time. */
/** @param {string | null | undefined} timeStr */
function toHourlyTimeKey(timeStr) {
  if (!timeStr) return null;
  return `${timeStr.slice(0, 13)}:00`;
}

/** Computes the current hour as a naive ISO string in the forecast location's timezone. */
/** @param {OpenMeteoData} data */
function currentHourStrForLocation(data) {
  const offsetSeconds = data.utc_offset_seconds ?? 0;
  const localMs = Date.now() + offsetSeconds * 1000;
  const d = new Date(localMs);
  /** @param {number} n */
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:00`;
}

/** Builds a normalized hour record from one row of Open-Meteo hourly arrays. */
/** @param {OpenMeteoData} data @param {number} idx @returns {HourlyWeather | null} */
function buildHourRecord(data, idx) {
  const t = data.hourly.time[idx];
  const feelsLike = data.hourly.apparent_temperature[idx];
  const wind = data.hourly.wind_speed_10m[idx];
  if (feelsLike == null || wind == null) return null;
  const gust = data.hourly.wind_gusts_10m?.[idx] ?? null;
  const rain = data.hourly.precipitation_probability[idx] ?? 0;
  const code = data.hourly.weather_code[idx];
  const dewpoint = data.hourly.dewpoint_2m[idx];
  const uv = data.hourly.uv_index?.[idx] ?? 0;
  return {
    hour: parseInt(t.slice(11, 13), 10),
    feelsLike,
    windSpeed: wind,
    windGust: gust,
    rainChance: rain,
    dewpoint,
    weatherCode: code,
    uv,
    condition: getHourlyCondition({ feelsLike, wind, gust, rain, code, dewpoint }),
  };
}

/** Extracts the next 24 hours of forecast data starting from the current hour. */
/** @param {OpenMeteoData} data @param {string} currentHourStr @returns {HourlyWeather[]} */
function parseHourly(data, currentHourStr) {
  const startIdx = data.hourly.time.findIndex((t) => t === currentHourStr);
  const offset = startIdx >= 0 ? startIdx : 0;
  return Array.from({ length: 24 }, (_, i) =>
    buildHourRecord(data, offset + i),
  ).filter((hour) => hour !== null);
}

/** Extracts up to `count` hours preceding the current hour. */
/** @param {OpenMeteoData} data @param {string} currentHourStr @param {number} count @returns {HourlyWeather[]} */
function parsePastHourly(data, currentHourStr, count) {
  const currentIdx = data.hourly.time.findIndex((t) => t === currentHourStr);
  if (currentIdx <= 0) return [];
  const startIdx = Math.max(0, currentIdx - count);
  return Array.from({ length: currentIdx - startIdx }, (_, i) =>
    buildHourRecord(data, startIdx + i),
  ).filter((hour) => hour !== null);
}

/** Parses the 8-day daily forecast into a simplified array with cycling conditions. */
/** @param {OpenMeteoData} data @returns {DailyWeather[]} */
function parseDaily(data) {
  // Per-date daylight window (sunrise/sunset hours) so temperature can be rated on
  // ridable hours only, ignoring overnight lows nobody would ride in.
  /** @type {Record<string, DaylightHours>} */
  const daylightByDate = {};
  data.daily.time.forEach((dateStr, i) => {
    const sr = data.daily.sunrise?.[i];
    const ss = data.daily.sunset?.[i];
    if (sr && ss) {
      daylightByDate[dateStr] = {
        sunriseHour: parseInt(sr.slice(11, 13), 10),
        sunsetHour: parseInt(ss.slice(11, 13), 10),
      };
    }
  });

  /** @type {Record<string, number>} */
  const dewpointByDate = {};
  /** @type {Record<string, TempRange>} */
  const daytimeFeelsByDate = {};
  data.hourly.time.forEach((t, i) => {
    const date = t.slice(0, 10);
    const dp = data.hourly.dewpoint_2m?.[i];
    if (
      dp != null &&
      (dewpointByDate[date] == null || dp > dewpointByDate[date])
    ) {
      dewpointByDate[date] = dp;
    }

    const feels = data.hourly.apparent_temperature?.[i];
    const dl = daylightByDate[date];
    const hour = parseInt(t.slice(11, 13), 10);
    if (feels != null && dl && hour >= dl.sunriseHour && hour < dl.sunsetHour) {
      const cur = daytimeFeelsByDate[date];
      if (!cur) daytimeFeelsByDate[date] = { min: feels, max: feels };
      else {
        if (feels < cur.min) cur.min = feels;
        if (feels > cur.max) cur.max = feels;
      }
    }
  });

  return data.daily.time.map((dateStr, i) => {
    const apparentMax = data.daily.apparent_temperature_max[i];
    const daytime = daytimeFeelsByDate[dateStr];
    // Rate temperature on the worst feels-like across daylight hours; fall back to
    // the day's apparent max when hourly daylight coverage is missing.
    const feelsLow = daytime ? daytime.min : apparentMax;
    const feelsHigh = daytime ? daytime.max : apparentMax;
    const gust = data.daily.wind_gusts_10m_max?.[i] ?? null;
    return {
      date: new Date(dateStr + "T12:00:00"),
      high: Math.round(data.daily.temperature_2m_max[i]),
      low: Math.round(data.daily.temperature_2m_min[i]),
      feelsLike: apparentMax,
      dewpoint: dewpointByDate[dateStr] ?? null,
      windSpeed: data.daily.wind_speed_10m_max[i],
      windGust: gust,
      rainChance: data.daily.precipitation_probability_max[i],
      weatherCode: data.daily.weather_code[i],
      condition: getDailyCondition({
        feelsLow,
        feelsHigh,
        wind: data.daily.wind_speed_10m_max[i],
        gust,
        rain: data.daily.precipitation_probability_max[i],
        code: data.daily.weather_code[i],
        dewpoint: dewpointByDate[dateStr] ?? null,
      }),
    };
  });
}

/** Formats a naive datetime string from Open-Meteo (in the location's TZ) as "H:MM AM/PM". */
/** @param {string | null | undefined} raw */
function formatLocationTime(raw) {
  if (!raw) return null;
  const [h, m] = raw.slice(11, 16).split(":").map(Number);
  const suffix = h < 12 ? "AM" : "PM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Extracts today's sunset time and formats it for display (e.g. "6:15 PM"). */
/** @param {OpenMeteoData} data */
function parseSunset(data) {
  return formatLocationTime(data.daily.sunset?.[0]);
}

/** Extracts today's sunrise time and formats it for display. */
/** @param {OpenMeteoData} data */
function parseSunrise(data) {
  return formatLocationTime(data.daily.sunrise?.[0]);
}

/** Returns sunrise/sunset as hour numbers for daylight comparison. */
/** @param {OpenMeteoData} data @returns {DaylightHours | null} */
function parseDaylightHours(data) {
  const sunrise = data.daily.sunrise?.[0];
  const sunset = data.daily.sunset?.[0];
  if (!sunrise || !sunset) return null;
  // Open-Meteo (timezone=auto) returns these as naive strings in the forecast
  // location's timezone. Parse the hour from the string directly so the value
  // matches hourly.time hours rather than shifting by the browser's TZ offset.
  return {
    sunriseHour: parseInt(sunrise.slice(11, 13), 10),
    sunsetHour: parseInt(sunset.slice(11, 13), 10),
  };
}

/** Maps NWS severity strings to our severity levels. */
/** @type {Record<string, WeatherAlert['severity']>} */
const NWS_SEVERITY = {
  Extreme: "extreme",
  Severe: "extreme",
  Moderate: "warning",
  Minor: "warning",
  Unknown: "warning",
};

/**
 * Fetches active NWS alerts for the given coordinates.
 * US-only (api.weather.gov); returns an empty array for non-US locations or on failure.
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<WeatherAlert[]>}
 */
export async function fetchNwsAlerts(lat, lon) {
  try {
    const res = await fetchWithTimeout(
      `https://api.weather.gov/alerts/active?point=${lat},${lon}`,
      {
        headers: {
          "User-Agent": "WheelyWeather/1.0",
          Accept: "application/geo+json",
        },
      },
      SECONDARY_FETCH_TIMEOUT_MS,
    );
    if (!res.ok) return [];
    const data = /** @type {{ features?: NwsFeature[] }} */ (await res.json());
    const features = data.features ?? [];
    return features.map((f) => {
      const p = f.properties;
      return {
        type: "nws",
        severity: p.severity ? NWS_SEVERITY[p.severity] || "warning" : "warning",
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
/** @param {number} lat @param {number} lon @returns {Promise<number | null>} */
export async function fetchAqi(lat, lon) {
  try {
    const res = await fetchWithTimeout(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`,
      {},
      SECONDARY_FETCH_TIMEOUT_MS,
    );
    if (res.ok) {
      const data = await res.json();
      return data.current?.us_aqi ?? null;
    }
  } catch {
    /* empty */
  }
  return null;
}

/** Fetches slower, non-critical enrichments that can update after first paint. */
/** @param {number} lat @param {number} lon @param {WeatherRequestOptions} [options] @returns {Promise<ForecastExtras>} */
export async function fetchWeatherExtras(lat, lon, options = {}) {
  const mockScenario = options.mockScenario ?? getMockScenario();
  if (mockScenario) {
    const mock = buildMockWeather(mockScenario);
    return { aqi: mock?.aqi ?? null, nwsAlerts: mock?.nwsAlerts ?? [] };
  }

  const [aqi, nwsAlerts] = await Promise.all([
    fetchAqi(lat, lon),
    fetchNwsAlerts(lat, lon),
  ]);
  return { aqi, nwsAlerts };
}

/**
 * Fetches current, hourly, and daily weather from Open-Meteo and assembles the
 * unified weather object used by the UI. Secondary enrichments arrive later.
 * @param {number} lat
 * @param {number} lon
 * @param {WeatherRequestOptions} [options]
 * @returns {Promise<Weather>}
 */
export async function fetchWeatherData(lat, lon, options = {}) {
  const mockScenario = options.mockScenario ?? getMockScenario();
  if (mockScenario) {
    // Short async tick so callers see the same loading flow as a real fetch.
    await new Promise((resolve) => setTimeout(resolve, 150));
    const mock = buildMockWeather(mockScenario);
    if (!mock) throw new Error("Unknown mock weather scenario");
    return mock;
  }

  const res = await fetchWithTimeout(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,dewpoint_2m,wind_direction_10m` +
      `&hourly=apparent_temperature,precipitation_probability,wind_speed_10m,wind_gusts_10m,weather_code,dewpoint_2m,uv_index` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,apparent_temperature_max,weather_code,sunset,sunrise,uv_index_max` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=8&past_hours=12`,
    {},
    FORECAST_FETCH_TIMEOUT_MS,
  );
  if (!res.ok) throw new Error("Weather API error");
  const data = /** @type {OpenMeteoData} */ (await res.json());
  if (!data.current) throw new Error("Weather API missing current data");

  // Align with the forecast location's timezone rather than the browser's local timezone.
  const currentHourStr =
    toHourlyTimeKey(data.current?.time) || currentHourStrForLocation(data);
  const hourIdx = data.hourly.time.findIndex((t) => t === currentHourStr);
  const currentRainChance =
    hourIdx >= 0 ? data.hourly.precipitation_probability[hourIdx] : 0;

  const hourlyParsed = parseHourly(data, currentHourStr);

  return {
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
    uvIndex: hourIdx >= 0 ? (data.hourly.uv_index?.[hourIdx] ?? null) : null,
    uvIndexDailyMax: data.daily.uv_index_max?.[0] ?? null,
    hourly: hourlyParsed,
    pastHourly: parsePastHourly(data, currentHourStr, 12),
    daily: parseDaily(data),
    sunrise: parseSunrise(data),
    sunset: parseSunset(data),
    daylight: parseDaylightHours(data),
    nwsAlerts: [],
  };
}
