import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchAqi,
  fetchNwsAlerts,
  fetchOpenMeteoData,
  fetchWeatherData,
  fetchWeatherExtras,
  type OpenMeteoData,
} from './weatherService';

// Covers the network layer around the (separately tested) parsing: URL
// construction, HTTP error handling, and the fail-soft behavior of the
// secondary AQI/alerts lookups.

const HOURS = Array.from({ length: 6 }, (_, i) => `2024-01-15T${String(i).padStart(2, '0')}:00`);
const N = HOURS.length;

function makePayload(): OpenMeteoData {
  return {
    utc_offset_seconds: 0,
    current: {
      time: HOURS[1],
      temperature_2m: 60,
      apparent_temperature: 62,
      wind_speed_10m: 5,
      wind_gusts_10m: 10,
      dewpoint_2m: 45,
      weather_code: 1,
      wind_direction_10m: 180,
    },
    hourly: {
      time: HOURS,
      temperature_2m: Array.from({ length: N }, () => 60),
      apparent_temperature: Array.from({ length: N }, () => 62),
      wind_speed_10m: Array.from({ length: N }, () => 5),
      wind_gusts_10m: Array.from({ length: N }, () => 8),
      precipitation_probability: Array.from({ length: N }, () => 0),
      weather_code: Array.from({ length: N }, () => 1),
      dewpoint_2m: Array.from({ length: N }, () => 45),
      uv_index: Array.from({ length: N }, () => 2),
    },
    daily: {
      time: ['2024-01-15'],
      sunrise: ['2024-01-15T07:00'],
      sunset: ['2024-01-15T18:00'],
      apparent_temperature_max: [70],
      temperature_2m_max: [68],
      temperature_2m_min: [48],
      wind_speed_10m_max: [8],
      wind_gusts_10m_max: [18],
      precipitation_probability_max: [10],
      weather_code: [1],
      uv_index_max: [5],
    },
  };
}

function stubFetchJson(body: unknown, ok = true): ReturnType<typeof vi.fn> {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(body), { status: ok ? 200 : 500 }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchOpenMeteoData', () => {
  it('requests the forecast for the given coordinates and returns the payload', async () => {
    const fetchMock = stubFetchJson(makePayload());

    const data = await fetchOpenMeteoData(40.7, -74);

    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain('latitude=40.7&longitude=-74');
    expect(url).toContain('temperature_unit=fahrenheit');
    expect(data.current?.temperature_2m).toBe(60);
  });

  it('throws on a non-OK HTTP response', async () => {
    stubFetchJson({}, false);
    await expect(fetchOpenMeteoData(40.7, -74)).rejects.toThrow('Weather API error');
  });

  it('throws when the payload has no current block', async () => {
    stubFetchJson({ hourly: {}, daily: {} });
    await expect(fetchOpenMeteoData(40.7, -74)).rejects.toThrow('Weather API missing current data');
  });
});

describe('fetchWeatherData', () => {
  it('fetches and parses into the unified weather object with default thresholds', async () => {
    stubFetchJson(makePayload());

    const weather = await fetchWeatherData(40.7, -74);

    expect(weather.temperature).toBe(60);
    expect(weather.hourly[0]?.hour).toBe(1);
    expect(weather.daily).toHaveLength(1);
  });
});

describe('fetchAqi', () => {
  it('returns the current US AQI on success', async () => {
    stubFetchJson({ current: { us_aqi: 42 } });
    await expect(fetchAqi(40.7, -74)).resolves.toBe(42);
  });

  it('returns null when the payload has no AQI value', async () => {
    stubFetchJson({ current: {} });
    await expect(fetchAqi(40.7, -74)).resolves.toBeNull();
  });

  it('returns null on a non-OK response', async () => {
    stubFetchJson({}, false);
    await expect(fetchAqi(40.7, -74)).resolves.toBeNull();
  });

  it('returns null when the request throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    await expect(fetchAqi(40.7, -74)).resolves.toBeNull();
  });
});

describe('fetchNwsAlerts', () => {
  it('maps NWS features to alerts, defaulting unknown severities to warning', async () => {
    stubFetchJson({
      features: [
        {
          properties: {
            severity: 'Extreme',
            event: 'Tornado Warning',
            headline: 'Tornado Warning issued',
            description: 'Take shelter now.',
            instruction: 'Move to an interior room.',
            expires: '2024-01-15T12:00:00Z',
          },
        },
        {
          properties: {
            severity: 'NotARealSeverity',
            event: 'Special Weather Statement',
            headline: null,
            description: null,
            instruction: null,
            expires: null,
          },
        },
        {
          properties: {
            severity: null,
            event: 'Dense Fog Advisory',
            headline: null,
            description: null,
            instruction: null,
            expires: null,
          },
        },
      ],
    });

    const alerts = await fetchNwsAlerts(40.7, -74);

    expect(alerts.map((a) => a.severity)).toEqual(['extreme', 'warning', 'warning']);
    expect(alerts[0]).toMatchObject({ type: 'nws', event: 'Tornado Warning' });
  });

  it('returns an empty array when the payload has no features', async () => {
    stubFetchJson({});
    await expect(fetchNwsAlerts(40.7, -74)).resolves.toEqual([]);
  });

  it('returns an empty array on a non-OK response', async () => {
    stubFetchJson({}, false);
    await expect(fetchNwsAlerts(40.7, -74)).resolves.toEqual([]);
  });

  it('returns an empty array when the request throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    await expect(fetchNwsAlerts(40.7, -74)).resolves.toEqual([]);
  });
});

describe('fetchWeatherExtras', () => {
  it('fetches AQI and alerts in parallel and merges them', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('air-quality')) {
          return Promise.resolve(
            new Response(JSON.stringify({ current: { us_aqi: 55 } }), { status: 200 }),
          );
        }
        return Promise.resolve(new Response(JSON.stringify({ features: [] }), { status: 200 }));
      }),
    );

    await expect(fetchWeatherExtras(40.7, -74)).resolves.toEqual({ aqi: 55, nwsAlerts: [] });
  });
});
