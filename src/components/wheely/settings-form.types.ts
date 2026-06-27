import type { Appearance } from '@/services/locationStorage';

export type GearMode = 'casual' | 'pro';

export interface SettingsFormProps {
  gearMode: GearMode;
  onGearChange: (mode: GearMode) => void;
  appearance: Appearance;
  onAppearanceChange: (value: Appearance) => void;
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
