import { WEATHER_DESCRIPTIONS } from './copy';

import type { Condition, RideStatus } from '@/types/weather';

export const getWeatherDescription = (code: number | null | undefined): string =>
  code == null ? 'Unknown' : (WEATHER_DESCRIPTIONS[code] ?? 'Unknown');

export const isThunderstorm = (code: number | null | undefined): boolean =>
  code != null && [95, 96, 99].includes(code);

// Weather codes add context that raw rain percentages can miss, especially for storms and snow.
export const getWeatherCodeCondition = (code: number | null | undefined): Condition => {
  if (code == null) return 'good';
  if (isThunderstorm(code)) return 'bad';
  // Freezing precipitation/fog implies ice on the road. The reference rates
  // ice/freezing as "avoid", and black ice on a fast descent is the real hazard,
  // so 48 (freezing fog) and 56/57/66/67 (freezing drizzle/rain) rate "bad".
  if ([48, 56, 57, 66, 67].includes(code)) return 'bad';
  if ([65, 75, 77, 82, 86].includes(code)) return 'poor';
  if ([55, 63, 71, 73, 81, 85].includes(code)) return 'marginal';
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

export const getWeatherCodeIssue = (
  code: number | null | undefined,
  status: RideStatus,
): string | null => {
  const rating = getWeatherCodeCondition(code);
  const shouldMention =
    status === 'maybe'
      ? rating === 'marginal' || rating === 'fair'
      : rating === 'bad' || rating === 'poor';
  if (!shouldMention) return null;
  return code == null ? null : (WEATHER_CODE_ISSUES[code] ?? null);
};
