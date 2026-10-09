import { afterEach, describe, expect, it, vi } from 'vitest';

import { THRESHOLDS } from '../src/domain/constants';
import { buildWeatherFromData } from '../src/services/weatherParsing';
import {
  fetchWeatherKitForecast,
  hasWeatherKitCredentials,
  resetWeatherKitToken,
  restConditionToWmoCode,
  toOpenMeteoData,
  utcOffsetSeconds,
  weatherKitToken,
  weatherKitUrl,
  type WeatherKitRestResponse,
} from './weatherkit';

const ZONE = 'America/New_York';
// 2026-10-10 14:20 EDT (UTC-4).
const NOW = new Date('2026-10-10T18:20:00Z');

function hourIso(offsetHours: number): string {
  return new Date(Date.UTC(2026, 9, 10, 18 + offsetHours)).toISOString();
}

function makeResponse(hourCount = 48): WeatherKitRestResponse {
  return {
    currentWeather: {
      asOf: '2026-10-10T18:20:00Z',
      temperature: 20,
      temperatureApparent: 21,
      temperatureDewPoint: 10,
      windSpeed: 16.09344,
      windGust: 32.18688,
      windDirection: 180,
      conditionCode: 'PartlyCloudy',
    },
    forecastHourly: {
      hours: Array.from({ length: hourCount }, (_, i) => ({
        forecastStart: hourIso(i),
        temperature: 20,
        temperatureApparent: 20,
        temperatureDewPoint: i === 1 ? undefined : 10,
        windSpeed: 8.04672,
        windGust: i === 1 ? undefined : 16.09344,
        precipitationChance: 0.92,
        precipitationAmount: 0.15,
        conditionCode: 'Drizzle',
        uvIndex: 3,
      })),
    },
    forecastDaily: {
      days: Array.from({ length: 10 }, (_, i) => ({
        // Days start at local midnight: 04:00 UTC in EDT.
        forecastStart: new Date(Date.UTC(2026, 9, 10 + i, 4)).toISOString(),
        sunrise: new Date(Date.UTC(2026, 9, 10 + i, 11, 16)).toISOString(),
        sunset: new Date(Date.UTC(2026, 9, 10 + i, 22, 45)).toISOString(),
        temperatureMax: 25,
        temperatureMin: 15,
        precipitationChance: 0.6,
        conditionCode: 'Thunderstorm',
        maxUvIndex: 5,
        windSpeedMax: i === 0 ? 24.14016 : undefined,
        windGustSpeedMax: i === 0 ? 40.2336 : undefined,
        daytimeForecast: { windSpeed: 16.09344 },
      })),
    },
  };
}

describe('restConditionToWmoCode', () => {
  it('maps codes that share the Swift name', () => {
    expect(restConditionToWmoCode('Clear')).toBe(0);
    expect(restConditionToWmoCode('MostlyCloudy')).toBe(3);
    expect(restConditionToWmoCode('Drizzle')).toBe(51);
    expect(restConditionToWmoCode('FreezingRain')).toBe(66);
  });

  it('translates REST-only names', () => {
    expect(restConditionToWmoCode('Fog')).toBe(45);
    expect(restConditionToWmoCode('Thunderstorm')).toBe(95);
    expect(restConditionToWmoCode('SevereThunderstorm')).toBe(99);
    expect(restConditionToWmoCode('ScatteredShowers')).toBe(80);
    expect(restConditionToWmoCode('MixedRainAndSnow')).toBe(67);
  });

  it('falls back to clear for unknown codes', () => {
    expect(restConditionToWmoCode('SomethingNew')).toBe(0);
  });
});

describe('utcOffsetSeconds', () => {
  it('follows daylight saving time', () => {
    expect(utcOffsetSeconds(ZONE, NOW)).toBe(-4 * 3600);
    expect(utcOffsetSeconds(ZONE, new Date('2026-12-01T12:00:00Z'))).toBe(-5 * 3600);
    expect(utcOffsetSeconds('Asia/Kolkata', NOW)).toBe(5.5 * 3600);
  });
});

describe('toOpenMeteoData', () => {
  it('converts units and formats naive local times', () => {
    const data = toOpenMeteoData(makeResponse(), ZONE, NOW);
    expect(data.utc_offset_seconds).toBe(-14_400);
    expect(data.current?.time).toBe('2026-10-10T14:20');
    expect(data.current?.temperature_2m).toBeCloseTo(68);
    expect(data.current?.wind_speed_10m).toBeCloseTo(10);
    expect(data.current?.wind_gusts_10m).toBeCloseTo(20);
    expect(data.current?.weather_code).toBe(2);
    expect(data.hourly.time[0]).toBe('2026-10-10T14:00');
    expect(data.hourly.precipitation_probability[0]).toBe(92);
    expect(data.hourly.precipitation?.[0]).toBe(0.15);
    expect(data.hourly.weather_code[0]).toBe(51);
    expect(data.hourly.wind_gusts_10m?.[1]).toBeNull();
    expect(data.hourly.dewpoint_2m[1]).toBeNull();
    expect(data.hourly.dewpoint_2m[0]).toBeCloseTo(50);
  });

  it('clips to eight local days and fills daily wind from the best field available', () => {
    const data = toOpenMeteoData(makeResponse(), ZONE, NOW);
    expect(data.daily.time).toHaveLength(8);
    expect(data.daily.time[0]).toBe('2026-10-10');
    expect(data.daily.sunrise?.[0]).toBe('2026-10-10T07:16');
    expect(data.daily.sunset?.[0]).toBe('2026-10-10T18:45');
    expect(data.daily.temperature_2m_max[0]).toBeCloseTo(77);
    expect(data.daily.apparent_temperature_max[0]).toBeCloseTo(77);
    expect(data.daily.precipitation_probability_max[0]).toBe(60);
    expect(data.daily.wind_speed_10m_max[0]).toBeCloseTo(15);
    expect(data.daily.wind_speed_10m_max[1]).toBeCloseTo(10);
    expect(data.daily.wind_gusts_10m_max?.[0]).toBeCloseTo(25);
    expect(data.daily.wind_gusts_10m_max?.[1]).toBeNull();
    expect(data.daily.weather_code[0]).toBe(95);
  });

  it('produces data the shared parser accepts', () => {
    const weather = buildWeatherFromData(toOpenMeteoData(makeResponse(), ZONE, NOW), THRESHOLDS);
    expect(weather.temperature).toBeCloseTo(68);
    expect(weather.daily.length).toBeGreaterThan(0);
    expect(weather.hourly.length).toBeGreaterThan(0);
  });

  it('rejects a response missing a data set', () => {
    const { forecastDaily: _omitted, ...partial } = makeResponse();
    expect(() => toOpenMeteoData(partial, ZONE, NOW)).toThrow('missing a data set');
  });
});

describe('weatherKitUrl', () => {
  it('asks for 12 past hours through eight days ahead, in the local zone', () => {
    const url = new URL(weatherKitUrl(35.78, -78.64, ZONE, NOW));
    expect(url.pathname).toBe('/api/v1/weather/en/35.78/-78.64');
    expect(url.searchParams.get('timezone')).toBe(ZONE);
    expect(url.searchParams.get('dataSets')).toBe('currentWeather,forecastHourly,forecastDaily');
    expect(url.searchParams.get('hourlyStart')).toBe('2026-10-10T06:00:00.000Z');
    expect(url.searchParams.get('hourlyEnd')).toBe('2026-10-18T19:00:00.000Z');
  });
});

async function makeCredentials() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ]);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  const body = btoa(String.fromCharCode(...pkcs8));
  return {
    publicKey: pair.publicKey,
    env: {
      WEATHERKIT_TEAM_ID: 'TEAM123',
      WEATHERKIT_SERVICE_ID: 'app.wheelyweather.weatherkit',
      WEATHERKIT_KEY_ID: 'KEY456',
      WEATHERKIT_PRIVATE_KEY: `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`,
    },
  };
}

function decodeSegment(segment: string): unknown {
  return JSON.parse(atob(segment.replaceAll('-', '+').replaceAll('_', '/')));
}

function base64UrlToBytes(segment: string): Uint8Array<ArrayBuffer> {
  const padded = segment.replaceAll('-', '+').replaceAll('_', '/');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

describe('weatherKitToken', () => {
  afterEach(() => {
    resetWeatherKitToken();
  });

  it('signs a verifiable ES256 token with the claims Apple expects', async () => {
    const { env, publicKey } = await makeCredentials();
    const token = await weatherKitToken(env, NOW.getTime());
    const [header = '', payload = '', signature = ''] = token.split('.');

    expect(decodeSegment(header)).toEqual({
      alg: 'ES256',
      kid: 'KEY456',
      id: 'TEAM123.app.wheelyweather.weatherkit',
    });
    const nowS = NOW.getTime() / 1000;
    expect(decodeSegment(payload)).toEqual({
      iss: 'TEAM123',
      sub: 'app.wheelyweather.weatherkit',
      iat: nowS,
      exp: nowS + 3600,
    });
    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      base64UrlToBytes(signature),
      new TextEncoder().encode(`${header}.${payload}`),
    );
    expect(valid).toBe(true);
  });

  it('accepts a key pasted with literal \\n escapes', async () => {
    const { env } = await makeCredentials();
    const escaped = {
      ...env,
      WEATHERKIT_PRIVATE_KEY: env.WEATHERKIT_PRIVATE_KEY.replaceAll('\n', '\\n'),
    };
    await expect(weatherKitToken(escaped, NOW.getTime())).resolves.toMatch(
      /^[\w-]+\.[\w-]+\.[\w-]+$/,
    );
  });

  it('reuses a token until it nears expiry', async () => {
    const { env } = await makeCredentials();
    const first = await weatherKitToken(env, NOW.getTime());
    expect(await weatherKitToken(env, NOW.getTime() + 30 * 60_000)).toBe(first);
    expect(await weatherKitToken(env, NOW.getTime() + 56 * 60_000)).not.toBe(first);
  });
});

describe('hasWeatherKitCredentials', () => {
  it('requires all four secrets', async () => {
    const { env } = await makeCredentials();
    expect(hasWeatherKitCredentials(env)).toBe(true);
    expect(hasWeatherKitCredentials({ ...env, WEATHERKIT_KEY_ID: '' })).toBe(false);
    expect(hasWeatherKitCredentials({})).toBe(false);
  });
});

describe('fetchWeatherKitForecast', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetWeatherKitToken();
  });

  it('looks up the zone, authenticates, and reshapes the response', async () => {
    const { env } = await makeCredentials();
    const fetchMock = vi.fn(() => Promise.resolve(Response.json(makeResponse())));
    vi.stubGlobal('fetch', fetchMock);

    const data = await fetchWeatherKitForecast(env, 35.78, -78.64, NOW);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(new URL(url).searchParams.get('timezone')).toBe(ZONE);
    expect((init.headers as Record<string, string>).Authorization).toMatch(/^Bearer /);
    expect(data.current?.time).toBe('2026-10-10T14:20');
  });

  it('throws on an upstream error', async () => {
    const { env } = await makeCredentials();
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('nope', { status: 401 })));
    await expect(fetchWeatherKitForecast(env, 35.78, -78.64, NOW)).rejects.toThrow(
      'WeatherKit 401',
    );
  });
});
