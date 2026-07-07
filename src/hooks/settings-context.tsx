import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import * as Localization from 'expo-localization';

import {
  clearHomeLocation,
  loadAllSettings,
  saveAppearance,
  saveGearMode,
  saveHomeLocation,
  saveTempUnit,
  type PersistedSettings,
  type SavedLocation,
} from '@/services/locationStorage';
import { DEFAULT_SETTINGS } from '@/services/settingsCodec';
import { captureError } from '@/services/telemetry';
import type { Appearance, GearMode, TempUnitPreference } from '@/types/settings';
import type { TempUnit } from '@/utils/temperature';

type SettingTuple<T> = readonly [T, (next: T) => void];

// Persistence is best-effort — write failures are swallowed so a flaky disk
// never breaks the in-session state, but still reported so they're not invisible.
const swallowWriteError = (error: unknown) => {
  captureError(error, { where: 'settings-context write' });
};

interface SettingsValue {
  gear: SettingTuple<GearMode>;
  appearance: SettingTuple<Appearance>;
  homeLocation: SettingTuple<SavedLocation | null>;
  tempUnit: SettingTuple<TempUnitPreference>;
  /** True once the persisted values have been read from storage. */
  hydrated: boolean;
}

// ---------- context ----------
// A single source of truth for the persisted settings, shared app-wide.
// Screens must consume these hooks (not ad-hoc storage state) so a toggle in
// Settings immediately reaches the root layout (theme) and the kit guide.
const SettingsContext = createContext<SettingsValue | null>(null);

// ---------- provider ----------
export function SettingsProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [settings, setSettings] = useState<PersistedSettings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  // All settings hydrate in a single batched read + one state commit, so first
  // paint after the splash already has the persisted appearance/units and
  // consumers gating on `hydrated` never observe a half-loaded mix.
  useEffect(() => {
    let cancelled = false;
    void loadAllSettings().then((loaded) => {
      if (cancelled) return;
      setSettings(loaded);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<SettingsValue>(
    () => ({
      gear: [
        settings.gearMode,
        (next: GearMode) => {
          setSettings((current) => ({ ...current, gearMode: next }));
          saveGearMode(next).catch(swallowWriteError);
        },
      ],
      appearance: [
        settings.appearance,
        (next: Appearance) => {
          setSettings((current) => ({ ...current, appearance: next }));
          saveAppearance(next).catch(swallowWriteError);
        },
      ],
      homeLocation: [
        settings.homeLocation,
        (next: SavedLocation | null) => {
          setSettings((current) => ({ ...current, homeLocation: next }));
          (next ? saveHomeLocation(next) : clearHomeLocation()).catch(swallowWriteError);
        },
      ],
      tempUnit: [
        settings.tempUnit,
        (next: TempUnitPreference) => {
          setSettings((current) => ({ ...current, tempUnit: next }));
          saveTempUnit(next).catch(swallowWriteError);
        },
      ],
      hydrated,
    }),
    [settings, hydrated],
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
 * Whether the persisted settings have been read from storage. Work that
 * depends on a setting's real value (e.g. the first forecast fetch reading
 * the home location) should wait for this to avoid acting on defaults.
 */
export function useSettingsHydrated(): boolean {
  return useSettings().hydrated;
}

/**
 * Resolves the persisted preference to a concrete display unit — 'auto'
 * follows the device locale, falling back to Fahrenheit when unknown.
 * `useLocales()` subscribes to locale changes instead of re-reading the
 * native module on every render (this hook runs ~once per displayed value).
 */
export function useResolvedTempUnit(): TempUnit {
  const [preference] = useTempUnit();
  const [locale] = Localization.useLocales();
  return preference === 'auto' ? (locale.temperatureUnit ?? 'fahrenheit') : preference;
}
