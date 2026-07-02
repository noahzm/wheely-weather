import type { Appearance, GearMode, TempUnitPreference } from '@/types/settings';

export {
  GEAR_LABELS,
  GEAR_MODES,
  APPEARANCE_LABELS,
  APPEARANCE_VALUES,
  TEMP_UNIT_LABELS,
  TEMP_UNIT_VALUES,
  type GearMode,
} from '@/types/settings';

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
