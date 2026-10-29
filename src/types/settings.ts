// Canonical home for the app's persisted user-preference types. Storage
// (services/locationStorage), the settings provider (hooks/settings-context),
// and the settings forms all import from here.

import { ALL_DAY_RIDE_HOURS } from '@/domain/ride-window';

export type GearMode = 'casual' | 'pro';

export type Appearance = 'system' | 'light' | 'dark';

export type TempUnitPreference = 'auto' | 'fahrenheit' | 'celsius';

// Display labels paired (by index) with their persisted values. Shared by the
// base and .ios settings forms so both platforms render identical options.
export const GEAR_LABELS = ['Casual', 'Roadie'] as const;
export const GEAR_MODES = ['casual', 'pro'] as const satisfies readonly GearMode[];

export const APPEARANCE_LABELS = ['System', 'Light', 'Dark'] as const;
export const APPEARANCE_VALUES = [
  'system',
  'light',
  'dark',
] as const satisfies readonly Appearance[];

export const TEMP_UNIT_LABELS = ['Auto', '°F', '°C'] as const;
export const TEMP_UNIT_VALUES = [
  'auto',
  'fahrenheit',
  'celsius',
] as const satisfies readonly TempUnitPreference[];

export type ExposureLevel = 'indoor' | 'moderate' | 'high';

// Asked as how often you ride outside, which riders can answer, rather than
// "exposure". The stored values keep their original names.
export const EXPOSURE_LABELS = ['Rarely', 'Some days', 'Most days'] as const;
export const EXPOSURE_VALUES = [
  'indoor',
  'moderate',
  'high',
] as const satisfies readonly ExposureLevel[];

/**
 * The exposure level assumed when the rider has not chosen one. Every fallback
 * — parsing, persisted defaults, service parameters, threshold resolution —
 * must reference this rather than restating 'moderate', so the assumption can
 * only ever be changed in one place.
 */
export const DEFAULT_EXPOSURE_LEVEL: ExposureLevel = 'moderate';

// Stored values; parseRideDuration also reads the old 'short', 'standard' and
// 'long' (1, 3 and 4 hours) from before the picker had seven lengths.
export type RideDuration = '1h' | '2h' | '3h' | '4h' | '5h' | '6h' | 'allDay';

export const RIDE_DURATION_LABELS = [
  '1 hour',
  '2 hours',
  '3 hours',
  '4 hours',
  '5 hours',
  '6 hours',
  'All day',
] as const;
export const RIDE_DURATION_VALUES = [
  '1h',
  '2h',
  '3h',
  '4h',
  '5h',
  '6h',
  'allDay',
] as const satisfies readonly RideDuration[];

export const DEFAULT_RIDE_DURATION: RideDuration = '3h';

export const DEFAULT_NIGHT_RIDING = false;

export const RIDE_DURATION_HOURS: Record<RideDuration, number> = {
  '1h': 1,
  '2h': 2,
  '3h': 3,
  '4h': 4,
  '5h': 5,
  '6h': 6,
  allDay: ALL_DAY_RIDE_HOURS,
};

/** The picker label for a stored ride length, e.g. "3 hours". */
export function rideDurationLabel(value: RideDuration): string {
  return RIDE_DURATION_LABELS[RIDE_DURATION_VALUES.indexOf(value)] ?? RIDE_DURATION_LABELS[2];
}
