import AsyncStorage from '@react-native-async-storage/async-storage';

import { fetchWithTimeout } from './http';
import type { SavedLocation } from './locationStorage';

/**
 * A rider's home-climate baseline: representative *warm* exposure at home, used
 * to estimate heat/humidity acclimatization. Derived from recent weather because
 * the body acclimatizes to recent exposure (~weeks), not annual normals.
 */
export interface HomeBaseline {
  warmTemp: number;
  warmDewpoint: number;
}

interface CachedBaseline extends HomeBaseline {
  version: 1;
  fetchedAt: number;
}

const CACHE_PREFIX = 'ww_home_climate_';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // acclimatization shifts slowly
const PAST_DAYS = 30;
const HOME_CLIMATE_TIMEOUT_MS = 4000;
// 75th-percentile of recent highs approximates the warm end a rider adapts to,
// without chasing a single freak-hot day.
const WARM_PERCENTILE = 0.75;

/** Rounds to ~11km so nearby coordinates share a cache entry. */
const roundCoord = (n: number) => Math.round(n * 10) / 10;
const cacheKey = (lat: number, lon: number) =>
  `${CACHE_PREFIX}${roundCoord(lat)}_${roundCoord(lon)}`;

function percentile(values: number[], p: number): number | null {
  const nums = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (nums.length === 0) return null;
  nums.sort((a, b) => a - b);
  const idx = Math.min(nums.length - 1, Math.floor(p * (nums.length - 1)));
  return nums[idx] ?? null;
}

async function readCache(lat: number, lon: number): Promise<HomeBaseline | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(lat, lon));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedBaseline>;
    if (parsed.version !== 1) return null;
    if (typeof parsed.fetchedAt !== 'number' || Date.now() - parsed.fetchedAt > CACHE_TTL_MS) {
      return null;
    }
    const { warmTemp, warmDewpoint } = parsed;
    if (typeof warmTemp !== 'number' || !Number.isFinite(warmTemp)) return null;
    if (typeof warmDewpoint !== 'number' || !Number.isFinite(warmDewpoint)) return null;
    return { warmTemp, warmDewpoint };
  } catch {
    return null;
  }
}

async function writeCache(lat: number, lon: number, baseline: HomeBaseline) {
  const payload: CachedBaseline = { version: 1, fetchedAt: Date.now(), ...baseline };
  try {
    await AsyncStorage.setItem(cacheKey(lat, lon), JSON.stringify(payload));
  } catch {
    // Best-effort cache; a failure just means we refetch next time.
  }
}

/**
 * Resolves the home-climate baseline for a location, fetching ~30 days of recent
 * weather from Open-Meteo and caching the result for a week. Returns null on any
 * failure so the verdict can fall back to the unadjusted thresholds.
 */
export async function getHomeBaseline(
  home: Pick<SavedLocation, 'lat' | 'lon'> | null | undefined,
): Promise<HomeBaseline | null> {
  if (!home) return null;
  const { lat, lon } = home;

  const cached = await readCache(lat, lon);
  if (cached) return cached;

  try {
    const res = await fetchWithTimeout(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&daily=temperature_2m_max&hourly=dewpoint_2m` +
        `&temperature_unit=fahrenheit&timezone=auto&past_days=${PAST_DAYS}&forecast_days=1`,
      {},
      HOME_CLIMATE_TIMEOUT_MS,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      daily?: { temperature_2m_max?: (number | null)[] };
      hourly?: { dewpoint_2m?: (number | null)[] };
    };

    const highs = (data.daily?.temperature_2m_max ?? []).filter(
      (v): v is number => typeof v === 'number',
    );
    const dews = (data.hourly?.dewpoint_2m ?? []).filter((v): v is number => typeof v === 'number');

    const warmTemp = percentile(highs, WARM_PERCENTILE);
    const warmDewpoint = percentile(dews, WARM_PERCENTILE);
    if (warmTemp == null || warmDewpoint == null) return null;

    const baseline: HomeBaseline = { warmTemp, warmDewpoint };
    await writeCache(lat, lon, baseline);
    return baseline;
  } catch {
    return null;
  }
}
