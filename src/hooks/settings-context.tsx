import { createContext, useContext, useMemo, type ReactNode } from 'react';

import * as Localization from 'expo-localization';

import { useGearMode as useGearModeStore } from './use-gear-mode';
import { useAppearance as useAppearanceStore } from './use-appearance';
import { useHomeLocation as useHomeLocationStore } from './use-home-location';
import { useTempUnit as useTempUnitStore } from './use-temp-unit';
import type { Appearance, SavedLocation, TempUnitPreference } from '@/services/locationStorage';
import type { TempUnit } from '@/utils/temperature';

type GearMode = 'casual' | 'pro';
type GearTuple = readonly [GearMode, (next: GearMode) => void];
type AppearanceTuple = readonly [Appearance, (next: Appearance) => void];
type HomeLocationTuple = readonly [SavedLocation | null, (next: SavedLocation | null) => void];
type TempUnitTuple = readonly [TempUnitPreference, (next: TempUnitPreference) => void];

interface SettingsValue {
  gear: GearTuple;
  appearance: AppearanceTuple;
  homeLocation: HomeLocationTuple;
  tempUnit: TempUnitTuple;
}

// ---------- context ----------
// A single source of truth for the persisted gear mode and appearance
// preference, shared app-wide. Previously each screen called the storage hooks
// directly, so they held isolated state — toggling in Settings never reached
// the root layout (theme) or the kit guide. The provider owns one instance of
// each store hook and broadcasts it through context.
const SettingsContext = createContext<SettingsValue | null>(null);

// ---------- provider ----------
export function SettingsProvider({ children }: Readonly<{ children: ReactNode }>) {
  const gear = useGearModeStore();
  const appearance = useAppearanceStore();
  const homeLocation = useHomeLocationStore();
  const tempUnit = useTempUnitStore();
  const value = useMemo<SettingsValue>(
    () => ({ gear, appearance, homeLocation, tempUnit }),
    [gear, appearance, homeLocation, tempUnit],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}

// ---------- consumers ----------
// Drop-in replacements for the standalone hooks: same `[value, setter]` shape,
// but reading from the shared provider so all screens stay in sync.
export function useGearMode(): GearTuple {
  return useSettings().gear;
}

export function useAppearance(): AppearanceTuple {
  return useSettings().appearance;
}

export function useHomeLocation(): HomeLocationTuple {
  return useSettings().homeLocation;
}

export function useTempUnit(): TempUnitTuple {
  return useSettings().tempUnit;
}

/**
 * Resolves the persisted preference to a concrete display unit — 'auto'
 * follows the device locale, falling back to Fahrenheit when unknown.
 */
export function useResolvedTempUnit(): TempUnit {
  const [preference] = useTempUnit();
  if (preference !== 'auto') return preference;
  return Localization.getLocales()[0].temperatureUnit ?? 'fahrenheit';
}
