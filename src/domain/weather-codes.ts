import { SNOW_BELOW_TEMP } from './constants';
import { WEATHER_DESCRIPTIONS } from './copy';

import type { Condition, RideStatus } from '@/types/weather';

/** Returns the human-readable description for a WMO weather interpretation code. */
export const getWeatherDescription = (code: number | null | undefined): string =>
  code == null ? 'Unknown' : (WEATHER_DESCRIPTIONS[code] ?? 'Unknown');

const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);

/** True when the WMO code reports rain or drizzle, freezing or not. */
export const isRainCode = (code: number | null | undefined): boolean =>
  code != null && RAIN_CODES.has(code);

/**
 * Whether precipitation would fall as snow, for naming it: snow when the code
 * says snow, rain when it says rain, and otherwise snow below freezing.
 */
export const isSnowy = (
  temp: number | null | undefined,
  code: number | null | undefined,
): boolean => {
  if (code != null && SNOW_CODES.has(code)) return true;
  if (isRainCode(code)) return false;
  return temp != null && temp < SNOW_BELOW_TEMP;
};

/** True when the WMO code indicates thunderstorm activity (95, 96, 99). */
export const isThunderstorm = (code: number | null | undefined): boolean =>
  code != null && [95, 96, 99].includes(code);

/**
 * Maps a WMO weather interpretation code to cycling ride-ability conditions.
 * Weather codes add context that raw rain percentages can miss, especially for
 * thunderstorms, ice, freezing rain, and snow.
 */
export const getWeatherCodeCondition = (code: number | null | undefined): Condition => {
  if (code == null) return 'good';
  if (isThunderstorm(code)) return 'bad';
  // Freezing precipitation/fog implies ice on the road. The reference rates
  // ice/freezing as "avoid", and black ice on a fast descent is the real hazard,
  // so 48 (freezing fog) and 56/57/66/67 (freezing drizzle/rain) rate "bad".
  if ([48, 56, 57, 66, 67].includes(code)) return 'bad';
  // Snow rates a step worse than rain of the same intensity: moderate snow (73)
  // settles on the road and takes the grip with it, where moderate rain (63)
  // only soaks the rider. Snow grains (77) are about as light as light snow.
  if ([65, 73, 75, 82, 86].includes(code)) return 'poor';
  if ([55, 63, 71, 77, 81, 85].includes(code)) return 'marginal';
  if ([45, 51, 53, 61, 80].includes(code)) return 'fair';
  return 'good';
};

const WEATHER_CODE_ISSUES: Record<number, string> = {
  45: 'fog',
  48: 'freezing fog',
  51: 'light drizzle',
  53: 'drizzle',
  55: 'heavy drizzle',
  56: 'freezing drizzle',
  57: 'freezing drizzle',
  61: 'light rain',
  63: 'rain',
  65: 'heavy rain',
  66: 'freezing rain',
  67: 'freezing rain',
  71: 'light snow',
  73: 'snow',
  75: 'heavy snow',
  77: 'snow grains',
  80: 'light showers',
  81: 'showers',
  82: 'heavy showers',
  85: 'light snow showers',
  86: 'snow showers',
};

/**
 * Resolves a weather code to an issue phrase (e.g. 'fog', 'heavy rain') if the code
 * warrants highlighting for the given ride verdict status ('maybe' vs 'no').
 */
export const getWeatherCodeIssue = (
  code: number | null | undefined,
  status: RideStatus,
): string | null => {
  const rating = getWeatherCodeCondition(code);
  const shouldMention =
    status === 'maybe'
      ? rating === 'marginal' || rating === 'fair'
      : rating === 'bad' || rating === 'poor';
  if (!shouldMention || code == null) return null;
  return WEATHER_CODE_ISSUES[code] ?? null;
};

/** The home scene's sky for a forecast: what the rider would see overhead. */
export type Sky =
  'clear' | 'partly' | 'overcast' | 'fog' | 'drizzle' | 'rain' | 'storm' | 'snow' | 'sleet';

/**
 * Every WMO code by the sky it gets. Freezing drizzle and rain get sleet's
 * wintry mix; hail comes with thunderstorms (96, 99). WeatherKit's conditions
 * arrive already translated to these codes (haze, smoke and dust as fog,
 * flurries and blizzards as snow, wintry mix as freezing rain).
 */
const SKY_BY_CODE: Readonly<Record<number, Sky>> = {
  0: 'clear',
  1: 'clear',
  2: 'partly',
  3: 'overcast',
  45: 'fog',
  48: 'fog',
  51: 'drizzle',
  53: 'drizzle',
  55: 'drizzle',
  56: 'sleet',
  57: 'sleet',
  61: 'rain',
  63: 'rain',
  65: 'rain',
  66: 'sleet',
  67: 'sleet',
  71: 'snow',
  73: 'snow',
  75: 'snow',
  77: 'snow',
  80: 'rain',
  81: 'rain',
  82: 'rain',
  85: 'snow',
  86: 'snow',
  95: 'storm',
  96: 'storm',
  99: 'storm',
};

/** The home scene's sky for a WMO code; null when unknown, so the caller can fall back. */
export const getSky = (code: number | null | undefined): Sky | null =>
  code == null ? null : (SKY_BY_CODE[code] ?? null);
