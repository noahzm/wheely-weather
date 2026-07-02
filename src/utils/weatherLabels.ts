import type { Condition } from '@/types/weather';

/** Human-friendly labels for weather metrics used in the UI. */
export const getAqiLabel = (aqi: number | null | undefined): string => {
  if (aqi == null) return '–';
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
};

export const getDewpointLabel = (dp: number | null | undefined): string => {
  if (dp == null) return '–';
  if (dp < 50) return 'Dry';
  if (dp < 60) return 'Comfortable';
  if (dp < 65) return 'Noticeable';
  if (dp < 70) return 'Muggy';
  return 'Oppressive';
};

export const getWindDirectionLabel = (degrees: number | null | undefined): string => {
  if (degrees == null) return '–';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
  return dirs[Math.round(degrees / 45) % 8] ?? '–';
};

/**
 * Open-Meteo returns the direction the wind comes from.
 * Lucide's Wind glyph points east at 0° rotation, so add 90° after the
 * 180° flip to align the icon with where the wind is blowing to.
 */
export const getWindArrowRotation = (degrees: number | null | undefined): number | null => {
  if (degrees == null) return null;
  return (degrees + 90) % 360;
};

export const getUvLabel = (uv: number): string => {
  if (uv <= 2) return 'Low';
  if (uv <= 5) return 'Moderate';
  if (uv <= 7) return 'High';
  if (uv <= 10) return 'Very High';
  return 'Extreme';
};

/** Maps a UV index value to the same 5-level condition scale used elsewhere. */
export const getUvCondition = (uv: number | null | undefined): Condition | undefined => {
  if (uv == null) return;
  if (uv <= 2) return 'good';
  if (uv <= 5) return 'fair';
  if (uv <= 7) return 'marginal';
  if (uv <= 10) return 'poor';
  return 'bad';
};
