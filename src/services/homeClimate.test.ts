import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getHomeBaseline } from './homeClimate';

const { store, storage } = vi.hoisted(() => {
  const store = new Map<string, string>();
  const storage = {
    getItem: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
  };
  return { store, storage };
});

vi.mock('@react-native-async-storage/async-storage', () => ({ default: storage }));

const HOME = { lat: 35.7796, lon: -78.6382 };
const CACHE_KEY = 'ww_home_climate_35.8_-78.6';
const DAY_MS = 24 * 60 * 60 * 1000;

// Five highs and four usable dewpoints: the 75th/25th percentiles land on
// 80/60 °F for highs and 60 °F for dewpoints (index floor(p * (n - 1))).
const ARCHIVE = {
  daily: { temperature_2m_max: [90, 50, null, 70, 60, 80] },
  hourly: { dewpoint_2m: [70, null, 40, 60, 50] },
};
const BASELINE = { warmTemp: 80, warmDewpoint: 60, coolTemp: 60 };

function stubFetch(body: unknown, ok = true) {
  const fetchMock = vi.fn((_url: string) =>
    Promise.resolve(new Response(JSON.stringify(body), { status: ok ? 200 : 500 })),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function cacheEntry(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({ version: 2, fetchedAt: Date.now(), ...BASELINE, ...overrides });
}

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getHomeBaseline', () => {
  it('returns null without a home, and fetches nothing', async () => {
    const fetchMock = stubFetch(ARCHIVE);
    await expect(getHomeBaseline(null)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('derives the baseline from recent highs and dewpoints, skipping gaps', async () => {
    const fetchMock = stubFetch(ARCHIVE);

    await expect(getHomeBaseline(HOME)).resolves.toEqual(BASELINE);

    const url = new URL(fetchMock.mock.calls[0]?.[0] ?? '');
    expect(url.searchParams.get('past_days')).toBe('30');
    expect(url.searchParams.get('temperature_unit')).toBe('fahrenheit');
  });

  it('caches the baseline under ~11 km rounded coordinates', async () => {
    stubFetch(ARCHIVE);
    await getHomeBaseline(HOME);
    expect(JSON.parse(store.get(CACHE_KEY) ?? '')).toMatchObject({ version: 2, ...BASELINE });

    // A nearby home reads the same entry without another request.
    const fetchMock = stubFetch(ARCHIVE);
    await expect(getHomeBaseline({ lat: 35.81, lon: -78.6 })).resolves.toEqual(BASELINE);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refetches a cache entry older than a week', async () => {
    store.set(CACHE_KEY, cacheEntry({ fetchedAt: Date.now() - 8 * DAY_MS, warmTemp: 99 }));
    const fetchMock = stubFetch(ARCHIVE);
    await expect(getHomeBaseline(HOME)).resolves.toEqual(BASELINE);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a v1 entry (no coolTemp)', cacheEntry({ version: 1, coolTemp: undefined })],
    ['a non-numeric field', cacheEntry({ warmDewpoint: 'humid' })],
    ['a missing fetchedAt', cacheEntry({ fetchedAt: undefined })],
    ['unparseable JSON', '{not json'],
  ])('ignores %s and refetches', async (_label, raw) => {
    store.set(CACHE_KEY, raw);
    const fetchMock = stubFetch(ARCHIVE);
    await expect(getHomeBaseline(HOME)).resolves.toEqual(BASELINE);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns null on an upstream error', async () => {
    stubFetch({}, false);
    await expect(getHomeBaseline(HOME)).resolves.toBeNull();
    expect(store.has(CACHE_KEY)).toBe(false);
  });

  it('returns null when a series is empty', async () => {
    stubFetch({ daily: { temperature_2m_max: [80] }, hourly: { dewpoint_2m: [null] } });
    await expect(getHomeBaseline(HOME)).resolves.toBeNull();
  });

  it('returns null when the request fails outright', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Network request failed')));
    await expect(getHomeBaseline(HOME)).resolves.toBeNull();
  });

  it('still returns the baseline when the cache write fails', async () => {
    stubFetch(ARCHIVE);
    storage.setItem.mockRejectedValueOnce(new Error('disk full'));
    await expect(getHomeBaseline(HOME)).resolves.toEqual(BASELINE);
  });
});
