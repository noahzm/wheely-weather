// Canonical home for the app's persisted user-preference types. Storage
// (services/locationStorage), the settings provider (hooks/settings-context),
// and the settings forms all import from here.

export type GearMode = 'casual' | 'pro';

export type Appearance = 'system' | 'light' | 'dark';

export type TempUnitPreference = 'auto' | 'fahrenheit' | 'celsius';

// Display labels paired (by index) with their persisted values. Shared by the
// base and .ios settings forms so both platforms render identical options.
export const GEAR_LABELS = ['Everyday', 'Performance'] as const;
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
