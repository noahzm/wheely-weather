import type { Appearance, TempUnitPreference } from '@/services/locationStorage';

export type GearMode = 'casual' | 'pro';

export interface SettingsFormProps {
  gearMode: GearMode;
  onGearChange: (mode: GearMode) => void;
  appearance: Appearance;
  onAppearanceChange: (value: Appearance) => void;
  tempUnit: TempUnitPreference;
  onTempUnitChange: (value: TempUnitPreference) => void;
  /** Label of the rider's saved home location, or null when unset. */
  homeLabel: string | null;
  /** True when there is an active location that can be saved as home. */
  canSetHome: boolean;
  /** Save the current active location as the acclimatization home. */
  onSetHome: () => void;
  /** Clear the home location (verdict reverts to reference defaults). */
  onClearHome: () => void;
}

// Display labels paired (by index) with their persisted values.
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
