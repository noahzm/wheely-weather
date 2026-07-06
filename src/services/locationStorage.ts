import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_SETTINGS,
  normalizeLocationRecord,
  parseAppearance,
  parseGearMode,
  parseHomeLocation,
  parseTempUnit,
  type PersistedSettings,
  type SavedLocation,
} from './settingsCodec';

import type { Appearance, GearMode, TempUnitPreference } from '@/types/settings';

export { normalizeLocationRecord, type PersistedSettings } from './settingsCodec';
export type { LocationSource, SavedLocation } from './settingsCodec';

const LOCATION_KEY = 'ww_location';
const HOME_LOCATION_KEY = 'ww_home_location';
const RECENTS_KEY = 'ww_recent_locations';
const PINS_KEY = 'ww_pinned_locations';
const GEAR_MODE_KEY = 'gearMode';
const APPEARANCE_KEY = 'ww_appearance';
const TEMP_UNIT_KEY = 'ww_temp_unit';
const RECENTS_MAX = 4;
const PINS_MAX = 8;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export async function loadSavedLocation() {
  try {
    const raw = await AsyncStorage.getItem(LOCATION_KEY);
    return normalizeLocationRecord(raw ? JSON.parse(raw) : null);
  } catch {
    return null;
  }
}

export async function saveLocation(location: SavedLocation) {
  const normalized = normalizeLocationRecord(location);
  if (!normalized) throw new Error('Invalid location');
  await AsyncStorage.setItem(LOCATION_KEY, JSON.stringify({ version: 1, ...normalized }));
  return normalized;
}

export async function clearLocation() {
  await AsyncStorage.removeItem(LOCATION_KEY);
}

export async function saveHomeLocation(location: SavedLocation) {
  const normalized = normalizeLocationRecord(location);
  if (!normalized) throw new Error('Invalid location');
  await AsyncStorage.setItem(HOME_LOCATION_KEY, JSON.stringify({ version: 1, ...normalized }));
  return normalized;
}

export async function clearHomeLocation() {
  await AsyncStorage.removeItem(HOME_LOCATION_KEY);
}

export interface RecentLocation {
  lat: number;
  lon: number;
  label: string;
  displayName?: string;
}

export function normalizeRecentLocation(value: unknown): RecentLocation | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const lat = Number(record.lat);
  const lon = Number(record.lon);
  if (!isFiniteNumber(lat) || !isFiniteNumber(lon)) return null;
  if (typeof record.label !== 'string' || !record.label.trim()) return null;
  return {
    lat,
    lon,
    label: record.label.trim().slice(0, 96),
    displayName: typeof record.displayName === 'string' ? record.displayName.slice(0, 180) : '',
  };
}

export async function loadRecentLocations() {
  try {
    const raw = await AsyncStorage.getItem(RECENTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeRecentLocation(item))
      .filter((place): place is RecentLocation => !!place)
      .slice(0, RECENTS_MAX);
  } catch {
    return [];
  }
}

export async function saveRecentLocation(place: RecentLocation) {
  const normalized = normalizeRecentLocation(place);
  if (!normalized) return [];
  const current = await loadRecentLocations();
  const next = [
    normalized,
    ...current.filter((saved) => saved.lat !== normalized.lat || saved.lon !== normalized.lon),
  ].slice(0, RECENTS_MAX);
  await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  return next;
}

export async function saveGearMode(mode: GearMode) {
  await AsyncStorage.setItem(GEAR_MODE_KEY, mode);
}

export async function saveAppearance(value: Appearance) {
  await AsyncStorage.setItem(APPEARANCE_KEY, value);
}

export async function saveTempUnit(value: TempUnitPreference) {
  await AsyncStorage.setItem(TEMP_UNIT_KEY, value);
}

/**
 * Loads all persisted settings in a single storage round-trip so the provider
 * can hydrate them in one state commit (no per-setting flicker). Never
 * rejects — any failure falls back to the defaults.
 */
export async function loadAllSettings(): Promise<PersistedSettings> {
  try {
    const entries = await AsyncStorage.multiGet([
      GEAR_MODE_KEY,
      APPEARANCE_KEY,
      HOME_LOCATION_KEY,
      TEMP_UNIT_KEY,
    ]);
    const byKey = new Map(entries);
    return {
      gearMode: parseGearMode(byKey.get(GEAR_MODE_KEY) ?? null),
      appearance: parseAppearance(byKey.get(APPEARANCE_KEY) ?? null),
      homeLocation: parseHomeLocation(byKey.get(HOME_LOCATION_KEY) ?? null),
      tempUnit: parseTempUnit(byKey.get(TEMP_UNIT_KEY) ?? null),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function loadPinnedLocations(): Promise<RecentLocation[]> {
  try {
    const raw = await AsyncStorage.getItem(PINS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeRecentLocation(item))
      .filter((place): place is RecentLocation => !!place)
      .slice(0, PINS_MAX);
  } catch {
    return [];
  }
}

export async function addPinnedLocation(place: RecentLocation): Promise<RecentLocation[]> {
  const normalized = normalizeRecentLocation(place);
  if (!normalized) return [];
  const current = await loadPinnedLocations();
  const next = [
    normalized,
    ...current.filter((saved) => saved.lat !== normalized.lat || saved.lon !== normalized.lon),
  ].slice(0, PINS_MAX);
  await AsyncStorage.setItem(PINS_KEY, JSON.stringify(next));
  return next;
}

export async function removePinnedLocation(lat: number, lon: number): Promise<RecentLocation[]> {
  const current = await loadPinnedLocations();
  const next = current.filter((saved) => saved.lat !== lat || saved.lon !== lon);
  await AsyncStorage.setItem(PINS_KEY, JSON.stringify(next));
  return next;
}
