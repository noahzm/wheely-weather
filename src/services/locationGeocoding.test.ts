import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const platform = vi.hoisted(() => ({ OS: 'android' }));

vi.mock('react-native', () => ({ Platform: platform }));

const { fetchLocationName, searchLocations } = await import('./locationGeocoding');
const { resolveSuggestion, searchLocations: searchFromFacade } = await import('./locationSearch');

function stubFetchJson(body: unknown, status = 200) {
  const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  platform.OS = 'android';
  vi.stubGlobal('__DEV__', true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('searchLocations', () => {
  it('returns an empty list for blank queries without fetching', async () => {
    const fetchMock = stubFetchJson([]);

    await expect(searchLocations('   ')).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('queries Nominatim with a User-Agent on native and parses valid candidates', async () => {
    const fetchMock = stubFetchJson([
      {
        lat: '35.7796',
        lon: '-78.6382',
        display_name: 'Raleigh, Wake County, North Carolina, USA',
        address: { city: 'Raleigh', state: 'North Carolina' },
      },
      {
        lat: '44.2619',
        lon: '-72.5754',
        display_name: 'Montpelier, VT',
        address: { town: 'Montpelier', country: 'United States' },
      },
      {
        lat: '36.0',
        lon: '-79.0',
        display_name: 'Outback Trailhead',
        address: {},
      },
      {
        lat: '37.0',
        lon: '-80.0',
      },
      {
        lat: 'not-a-number',
        lon: '-78.0',
      },
      {
        lon: '-78.0',
      },
    ]);

    const results = await searchLocations('  Raleigh  ');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://nominatim.openstreetmap.org/search?q=Raleigh&format=json&addressdetails=1&limit=5',
      expect.objectContaining({
        headers: { 'User-Agent': 'WheelyWeather/1.0' },
      }),
    );
    expect(results).toEqual([
      {
        lat: 35.7796,
        lon: -78.6382,
        label: 'Raleigh, North Carolina',
        displayName: 'Raleigh, Wake County, North Carolina, USA',
      },
      {
        lat: 44.2619,
        lon: -72.5754,
        label: 'Montpelier, United States',
        displayName: 'Montpelier, VT',
      },
      {
        lat: 36,
        lon: -79,
        label: 'Outback Trailhead',
        displayName: 'Outback Trailhead',
      },
      {
        lat: 37,
        lon: -80,
        label: 'Unknown location',
        displayName: undefined,
      },
    ]);
  });

  it('uses the /api/geocode/search Worker proxy in web production and omits User-Agent on web dev', async () => {
    platform.OS = 'web';
    vi.stubGlobal('__DEV__', false);
    const prodFetch = stubFetchJson([]);

    await searchLocations('Portland');
    expect(prodFetch).toHaveBeenCalledWith(
      '/api/geocode/search?q=Portland',
      expect.objectContaining({ signal: expect.any(AbortSignal) as AbortSignal }),
    );

    vi.stubGlobal('__DEV__', true);
    const devFetch = stubFetchJson([]);
    await searchLocations('Portland');
    expect(devFetch).toHaveBeenCalledWith(
      expect.stringContaining('nominatim.openstreetmap.org/search'),
      expect.objectContaining({ headers: {} }),
    );
  });

  it('drops repeats of the same place, keeping the first (higher-ranked) one', async () => {
    const address = { city: 'Colorado Springs', state: 'Colorado' };
    const displayName = 'Colorado Springs, El Paso County, Colorado, United States';
    stubFetchJson([
      { lat: '38.8339', lon: '-104.8253', address, display_name: displayName },
      { lat: '38.7990', lon: '-104.7980', address, display_name: displayName },
      {
        lat: '38.8000',
        lon: '-104.8000',
        address: { county: 'El Paso County', state: 'Colorado' },
        display_name: 'El Paso County, Colorado, United States',
      },
    ]);
    const results = await searchLocations('Colorado Springs');
    expect(results.map((r) => [r.label, r.lat])).toEqual([
      ['Colorado Springs, Colorado', 38.8339],
      ['El Paso County, Colorado', 38.8],
    ]);
  });

  it('returns an empty list when the payload is not an array', async () => {
    stubFetchJson({ unexpected: true });
    await expect(searchLocations('Raleigh')).resolves.toEqual([]);
  });

  it('throws specific errors on HTTP 429 and other upstream failures', async () => {
    stubFetchJson({}, 429);
    await expect(searchLocations('Raleigh')).rejects.toThrow('Rate limited');

    stubFetchJson({}, 502);
    await expect(searchLocations('Raleigh')).rejects.toThrow('Search failed: 502');
  });
});

describe('fetchLocationName', () => {
  it('reverse-geocodes coordinates and abbreviates US state names', async () => {
    const fetchMock = stubFetchJson({
      address: {
        city: 'Raleigh',
        state: 'North Carolina',
        country_code: 'us',
      },
    });

    await expect(fetchLocationName(35.78, -78.64)).resolves.toBe('Raleigh, NC');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://nominatim.openstreetmap.org/reverse?lat=35.78&lon=-78.64&format=json',
      expect.objectContaining({
        headers: { 'User-Agent': 'WheelyWeather/1.0' },
      }),
    );
  });

  it('routes reverse geocoding through /api/geocode/reverse on web production', async () => {
    platform.OS = 'web';
    vi.stubGlobal('__DEV__', false);
    const fetchMock = stubFetchJson({
      address: { town: 'Carrboro', state: 'North Carolina', country_code: 'us' },
    });

    await expect(fetchLocationName(35.91, -79.08)).resolves.toBe('Carrboro, NC');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/geocode/reverse?lat=35.91&lon=-79.08',
      expect.any(Object),
    );
  });

  it('falls back to "Your Location" when address is missing or the request fails', async () => {
    stubFetchJson({});
    await expect(fetchLocationName(35.78, -78.64)).resolves.toBe('Your Location');

    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );
    await expect(fetchLocationName(35.78, -78.64)).resolves.toBe('Your Location');
  });
});

describe('locationSearch default facade', () => {
  it('re-exports searchLocations and resolves suggestions to null on non-iOS platforms', async () => {
    expect(searchFromFacade).toBe(searchLocations);
    await expect(resolveSuggestion('any-id')).resolves.toBeNull();
  });
});
