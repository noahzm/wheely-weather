import AsyncStorage from '@react-native-async-storage/async-storage';

export type LocationSource = 'manual' | 'device';

export type SavedLocation = {
  lat: number;
  lon: number;
  name: string | null;
  source: LocationSource;
};

const LOCATION_KEY = 'ww_location';
const RECENTS_KEY = 'ww_recent_locations';
const GEAR_MODE_KEY = 'gearMode';
const RECENTS_MAX = 4;

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
  await AsyncStorage.setItem(
    LOCATION_KEY,
    JSON.stringify({ version: 1, ...normalized }),
  );
  return normalized;
}

export async function clearLocation() {
  await AsyncStorage.removeItem(LOCATION_KEY);
}

export type RecentLocation = {
  lat: number;
  lon: number;
  label: string;
  displayName?: string;
};

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
    displayName:
      typeof record.displayName === 'string' ? record.displayName.slice(0, 180) : '',
  };
}

export async function loadRecentLocations() {
  try {
    const raw = await AsyncStorage.getItem(RECENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeRecentLocation)
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

export async function loadGearMode() {
  try {
    return (await AsyncStorage.getItem(GEAR_MODE_KEY)) === 'pro' ? 'pro' : 'casual';
  } catch {
    return 'casual';
  }
}

export async function saveGearMode(mode: 'casual' | 'pro') {
  await AsyncStorage.setItem(GEAR_MODE_KEY, mode);
}
