import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import * as Localization from 'expo-localization';

import {
  clearHomeLocation,
  loadAppearance,
  loadGearMode,
  loadHomeLocation,
  loadTempUnit,
  saveAppearance,
  saveGearMode,
  saveHomeLocation,
  saveTempUnit,
  type SavedLocation,
} from '@/services/locationStorage';
import type { Appearance, GearMode, TempUnitPreference } from '@/types/settings';
import type { TempUnit } from '@/utils/temperature';

type SettingTuple<T> = readonly [T, (next: T) => void];

interface SettingsValue {
  gear: SettingTuple<GearMode>;
  appearance: SettingTuple<Appearance>;
  homeLocation: SettingTuple<SavedLocation | null>;
  tempUnit: SettingTuple<TempUnitPreference>;
}

/**
 * One persisted setting: seeded from storage on mount, then written back on
 * every change. Persistence is best-effort — write failures are swallowed so a
 * flaky disk never breaks the in-session state.
 */
function usePersistedSetting<T>(
  initial: T,
  load: () => Promise<T>,
  save: (next: T) => Promise<unknown>,
): SettingTuple<T> {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    void load().then(setValue);
  }, [load]);

  const select = (next: T) => {
    setValue(next);
    save(next).catch(() => {
      // Best-effort persistence; ignore write failures.
    });
  };

  return [value, select];
}

// ---------- context ----------
// A single source of truth for the persisted settings, shared app-wide.
// Screens must consume these hooks (not ad-hoc storage state) so a toggle in
// Settings immediately reaches the root layout (theme) and the kit guide.
const SettingsContext = createContext<SettingsValue | null>(null);

// ---------- provider ----------
export function SettingsProvider({ children }: Readonly<{ children: ReactNode }>) {
  const gear = usePersistedSetting<GearMode>('casual', loadGearMode, saveGearMode);
  const appearance = usePersistedSetting<Appearance>('system', loadAppearance, saveAppearance);
  const homeLocation = usePersistedSetting<SavedLocation | null>(null, loadHomeLocation, (next) =>
    next ? saveHomeLocation(next) : clearHomeLocation(),
  );
  const tempUnit = usePersistedSetting<TempUnitPreference>('auto', loadTempUnit, saveTempUnit);
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
// Same `[value, setter]` shape as useState, reading from the shared provider
// so all screens stay in sync.
export function useGearMode(): SettingTuple<GearMode> {
  return useSettings().gear;
}

export function useAppearance(): SettingTuple<Appearance> {
  return useSettings().appearance;
}

export function useHomeLocation(): SettingTuple<SavedLocation | null> {
  return useSettings().homeLocation;
}

export function useTempUnit(): SettingTuple<TempUnitPreference> {
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
