// Pure parsing/validation for persisted settings values. Kept free of
// AsyncStorage (and any react-native import) so it runs under the node-env
// unit test project; locationStorage.ts owns the actual storage I/O.

import type { Appearance, GearMode, TempUnitPreference } from '@/types/settings';

export type LocationSource = 'manual' | 'device';

export interface SavedLocation {
  lat: number;
  lon: number;
  name: string | null;
  source: LocationSource;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function cleanName(value: unknown) {
  if (typeof value !== 'string') return null;
  const next = value.trim();
  return next ? next.slice(0, 96) : null;
}

export function normalizeLocationRecord(value: unknown): SavedLocation | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const lat = Number(record.lat);
  const lon = Number(record.lon);
  if (!isFiniteNumber(lat) || !isFiniteNumber(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  const source = record.source === 'device' ? 'device' : 'manual';
  return {
    lat,
    lon,
    name: cleanName(record.name),
    source,
  };
}

export function parseGearMode(raw: string | null): GearMode {
  return raw === 'pro' ? 'pro' : 'casual';
}

export function parseAppearance(raw: string | null): Appearance {
  return raw === 'light' || raw === 'dark' ? raw : 'system';
}

export function parseTempUnit(raw: string | null): TempUnitPreference {
  return raw === 'fahrenheit' || raw === 'celsius' ? raw : 'auto';
}

export function parseHomeLocation(raw: string | null): SavedLocation | null {
  try {
    return normalizeLocationRecord(raw ? JSON.parse(raw) : null);
  } catch {
    return null;
  }
}

export interface PersistedSettings {
  gearMode: GearMode;
  appearance: Appearance;
  homeLocation: SavedLocation | null;
  tempUnit: TempUnitPreference;
}

export const DEFAULT_SETTINGS: PersistedSettings = {
  gearMode: 'casual',
  appearance: 'system',
  homeLocation: null,
  tempUnit: 'auto',
};
