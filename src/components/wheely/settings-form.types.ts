import type { Appearance, ExposureLevel, GearMode, TempUnitPreference } from '@/types/settings';
import type { HomeBaseline } from '@/types/weather';

export {
  GEAR_LABELS,
  GEAR_MODES,
  APPEARANCE_LABELS,
  APPEARANCE_VALUES,
  TEMP_UNIT_LABELS,
  TEMP_UNIT_VALUES,
  EXPOSURE_LABELS,
  EXPOSURE_VALUES,
  type GearMode,
  type ExposureLevel,
} from '@/types/settings';

export interface SettingsFormProps {
  gearMode: GearMode;
  onGearChange: (mode: GearMode) => void;
  appearance: Appearance;
  onAppearanceChange: (value: Appearance) => void;
  tempUnit: TempUnitPreference;
  onTempUnitChange: (value: TempUnitPreference) => void;
  // Required, not optional: the settings screen always supplies these, so an
  // optional prop would convert a wiring break into a silently missing control
  // plus a default-exposure fallback that disagrees with the live forecast.
  exposureLevel: ExposureLevel;
  onExposureChange: (level: ExposureLevel) => void;
  homeBaseline: HomeBaseline | null;
  /** Label of the rider's saved home location, or null when unset. */
  homeLabel: string | null;
  /** True when there is an active location that can be saved as home. */
  canSetHome: boolean;
  /** Save the current active location as the acclimatization home. */
  onSetHome: () => void;
  /** Clear the home location (verdict reverts to reference defaults). */
  onClearHome: () => void;
}
