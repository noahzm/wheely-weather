import { describe, expect, it } from 'vitest';

import { THRESHOLDS } from '../domain/constants';

import { buildWeatherFromData, type OpenMeteoData } from './weatherService';

// This covers the Open-Meteo parsing layer inside buildWeatherFromData —
// current-hour alignment, the daylight-window aggregation used to rate daily
// conditions, and the defensive null-filtering that drops malformed rows
// instead of fabricating 0°/0% values. Exercised through the exported
// buildWeatherFromData surface rather than the internal parse* helpers, which
// aren't exported (matches the rest of this codebase's test style).

function hourTime(dateISO: string, hour: number): string {
  return `${dateISO}T${String(hour).padStart(2, '0')}:00`;
}

// DailyWeather.date is typed as Date | string (other producers, e.g. cache
// decoding, may hand back a string); parseDaily always builds a real Date,
// but normalize defensively so the test isn't tied to that internal.
function toISODate(value: Date | string): string {
  return (typeof value === 'string' ? new Date(value) : value).toISOString().slice(0, 10);
}

const DEFAULT_HOURLY_TIME = Array.from({ length: 6 }, (_, i) => hourTime('2024-01-15', i));
const DEFAULT_DAILY_TIME = ['2024-01-15'];

interface Fixture {
  utcOffsetSeconds?: number;
  current?: Partial<NonNullable<OpenMeteoData['current']>>;
  hourly?: Partial<OpenMeteoData['hourly']>;
  daily?: Partial<OpenMeteoData['daily']>;
}

/**
 * Builds a minimal, fully-populated Open-Meteo payload. Tests only need to
 * override the specific fields they're exercising; array lengths follow
 * whatever `hourly.time`/`daily.time` override is passed in.
 */
function makeOpenMeteoData(fixture: Fixture = {}): OpenMeteoData {
  const hourlyTime = fixture.hourly?.time ?? DEFAULT_HOURLY_TIME;
  const n = hourlyTime.length;
  const dailyTime = fixture.daily?.time ?? DEFAULT_DAILY_TIME;
  const dn = dailyTime.length;

  return {
    utc_offset_seconds: fixture.utcOffsetSeconds ?? 0,
    current: {
      time: hourTime('2024-01-15', 2),
      temperature_2m: 60,
      apparent_temperature: 62,
      wind_speed_10m: 5,
      wind_gusts_10m: 10,
      dewpoint_2m: 45,
      weather_code: 1,
      wind_direction_10m: 180,
      ...fixture.current,
    },
    hourly: {
      time: hourlyTime,
      temperature_2m: Array.from({ length: n }, () => 60),
      apparent_temperature: Array.from({ length: n }, () => 62),
      wind_speed_10m: Array.from({ length: n }, () => 5),
      wind_gusts_10m: Array.from({ length: n }, () => 8),
      precipitation_probability: Array.from({ length: n }, () => 0),
      weather_code: Array.from({ length: n }, () => 1),
      dewpoint_2m: Array.from({ length: n }, () => 45),
      uv_index: Array.from({ length: n }, () => 2),
      ...fixture.hourly,
    },
    daily: {
      time: dailyTime,
      sunrise: Array.from({ length: dn }, () => hourTime('2024-01-15', 7)),
      sunset: Array.from({ length: dn }, () => hourTime('2024-01-15', 18)),
      apparent_temperature_max: Array.from({ length: dn }, () => 70),
      temperature_2m_max: Array.from({ length: dn }, () => 68),
      temperature_2m_min: Array.from({ length: dn }, () => 48),
      wind_speed_10m_max: Array.from({ length: dn }, () => 8),
      wind_gusts_10m_max: Array.from({ length: dn }, () => 18),
      precipitation_probability_max: Array.from({ length: dn }, () => 10),
      weather_code: Array.from({ length: dn }, () => 1),
      uv_index_max: Array.from({ length: dn }, () => 5),
      ...fixture.daily,
    },
  };
}

describe('buildWeatherFromData — current-hour alignment', () => {
  it('starts the hourly window at the current hour and stops at the end of available data', () => {
    const hourlyTime = Array.from({ length: 15 }, (_, i) => hourTime('2024-01-15', i));
    const data = makeOpenMeteoData({
      current: { time: hourTime('2024-01-15', 3) },
      hourly: { time: hourlyTime },
    });

    const weather = buildWeatherFromData(data, THRESHOLDS);

    // The fixture only has 15 hours total, so the window is clipped to
    // indices 3..14 (12 hours) rather than padded to a full 24.
    expect(weather.hourly).toHaveLength(12);
    expect(weather.hourly[0]?.hour).toBe(3);
    expect(weather.hourly.at(-1)?.hour).toBe(14);
  });

  it('falls back to the start of the array and zeroes rain/UV when the current hour is missing', () => {
    const hourlyTime = Array.from({ length: 5 }, (_, i) => hourTime('2024-01-15', i + 8));
    const data = makeOpenMeteoData({
      current: { time: hourTime('2024-01-15', 2) }, // not present in hourly.time
      hourly: { time: hourlyTime },
    });

    const weather = buildWeatherFromData(data, THRESHOLDS);

    expect(weather.hourly[0]?.hour).toBe(8);
    expect(weather.hourly).toHaveLength(5);
    expect(weather.rainChance).toBe(0);
    expect(weather.uvIndex).toBeNull();
  });

  it('normalizes floating-point rain chance values to rounded whole percents', () => {
    const hourlyTime = Array.from({ length: 3 }, (_, i) => hourTime('2024-01-15', i));
    const data = makeOpenMeteoData({
      current: { time: hourTime('2024-01-15', 1) },
      hourly: {
        time: hourlyTime,
        precipitation_probability: [10.2, 56 + 1e-14, 77.8],
      },
      daily: {
        time: ['2024-01-15'],
        precipitation_probability_max: [44.6],
      },
    });

    const weather = buildWeatherFromData(data, THRESHOLDS);

    expect(weather.rainChance).toBe(56);
    expect(weather.hourly[0]?.rainChance).toBe(56);
    expect(weather.daily[0]?.rainChance).toBe(45);
  });
});

describe('buildWeatherFromData — past hourly window', () => {
  it('clips past hours at the start of the array when fewer than the requested count are available', () => {
    const hourlyTime = Array.from({ length: 6 }, (_, i) => hourTime('2024-01-15', i));
    const data = makeOpenMeteoData({
      current: { time: hourTime('2024-01-15', 3) },
      hourly: { time: hourlyTime },
    });

    const weather = buildWeatherFromData(data, THRESHOLDS);

    expect(weather.pastHourly.map((h) => h.hour)).toEqual([0, 1, 2]);
  });

  it('returns no past hours when the current hour is first in the array or not found', () => {
    const hourlyTime = Array.from({ length: 4 }, (_, i) => hourTime('2024-01-15', i));
    const atStart = buildWeatherFromData(
      makeOpenMeteoData({
        current: { time: hourTime('2024-01-15', 0) },
        hourly: { time: hourlyTime },
      }),
      THRESHOLDS,
    );
    expect(atStart.pastHourly).toEqual([]);

    const notFound = buildWeatherFromData(
      makeOpenMeteoData({
        current: { time: hourTime('2024-01-16', 0) },
        hourly: { time: hourlyTime },
      }),
      THRESHOLDS,
    );
    expect(notFound.pastHourly).toEqual([]);
  });
});

describe('buildWeatherFromData — malformed hourly rows', () => {
  it('drops hours past the end of a short parallel array instead of fabricating 0°', () => {
    const hourlyTime = Array.from({ length: 6 }, (_, i) => hourTime('2024-01-15', i));
    // Real API responses keep parallel arrays in lockstep, but parsing should
    // stay defensive: a truncated temperature_2m array should drop those
    // hours, not read them as undefined -> 0.
    const shortTemps = [58, 59, 60, 61]; // only 4 of 6 hours have a temperature

    const data = makeOpenMeteoData({
      current: { time: hourTime('2024-01-15', 0) },
      hourly: { time: hourlyTime, temperature_2m: shortTemps },
    });

    const weather = buildWeatherFromData(data, THRESHOLDS);

    expect(weather.hourly.map((h) => h.hour)).toEqual([0, 1, 2, 3]);
  });

  it('drops an hour with an explicit null wind reading rather than treating it as calm', () => {
    const hourlyTime = Array.from({ length: 4 }, (_, i) => hourTime('2024-01-15', i));
    const wind = [5, 6, null, 8] as unknown as number[];

    const data = makeOpenMeteoData({
      current: { time: hourTime('2024-01-15', 0) },
      hourly: { time: hourlyTime, wind_speed_10m: wind },
    });

    const weather = buildWeatherFromData(data, THRESHOLDS);

    expect(weather.hourly.map((h) => h.hour)).toEqual([0, 1, 3]);
  });
});

describe('buildWeatherFromData — daily parsing', () => {
  it('drops a daily row missing a required field instead of fabricating 0°/0%', () => {
    const dailyTime = ['2024-01-15', '2024-01-16'];
    const data = makeOpenMeteoData({
      daily: {
        time: dailyTime,
        wind_speed_10m_max: [10, null] as unknown as number[],
      },
    });

    const weather = buildWeatherFromData(data, THRESHOLDS);

    expect(weather.daily.map((d) => toISODate(d.date))).toEqual(['2024-01-15']);
  });

  it('buckets peak dewpoint per date rather than sharing it across days', () => {
    const day0 = Array.from({ length: 4 }, (_, h) => hourTime('2024-01-15', h));
    const day1 = Array.from({ length: 4 }, (_, h) => hourTime('2024-01-16', h));
    const data = makeOpenMeteoData({
      current: { time: day0[0] },
      hourly: {
        time: [...day0, ...day1],
        dewpoint_2m: [40, 55, 50, 45, 60, 58, 62, 59],
      },
      daily: {
        time: ['2024-01-15', '2024-01-16'],
        sunrise: [undefined, undefined] as unknown as string[],
        sunset: [undefined, undefined] as unknown as string[],
      },
    });

    const weather = buildWeatherFromData(data, THRESHOLDS);

    expect(weather.daily[0]?.dewpoint).toBe(55);
    expect(weather.daily[1]?.dewpoint).toBe(62);
  });

  it('does not let one rough sunrise hour condemn an otherwise good ride day', () => {
    const hours = Array.from({ length: 24 }, (_, h) => hourTime('2024-01-20', h));
    // Sunrise is bitterly cold, but a later three-hour window is comfortable.
    const temps = hours.map((_, h) => (h === 7 ? 20 : 60));
    const data = makeOpenMeteoData({
      current: { time: hourTime('2024-01-20', 0) },
      hourly: { time: hours, temperature_2m: temps },
      daily: {
        time: ['2024-01-20'],
        sunrise: [hourTime('2024-01-20', 7)],
        sunset: [hourTime('2024-01-20', 18)],
      },
    });

    const weather = buildWeatherFromData(data, THRESHOLDS);

    expect(weather.daily[0]?.condition).toBe('good');
    expect(weather.daily[0]?.rideWindow?.startHour).toBe(8);
  });

  it('excludes the sunset hour from the daytime window used to rate conditions', () => {
    const hours = Array.from({ length: 24 }, (_, h) => hourTime('2024-01-20', h));
    // Sunset hour (18) reads a "bad" cold snap; every daylight hour before it
    // is comfortable. If the window correctly excludes hour 18, that cold
    // snap should NOT affect the daily condition.
    const temps = hours.map((_, h) => (h === 18 ? 20 : 60));
    const data = makeOpenMeteoData({
      current: { time: hourTime('2024-01-20', 0) },
      hourly: { time: hours, temperature_2m: temps },
      daily: {
        time: ['2024-01-20'],
        sunrise: [hourTime('2024-01-20', 7)],
        sunset: [hourTime('2024-01-20', 18)],
      },
    });

    const weather = buildWeatherFromData(data, THRESHOLDS);

    expect(weather.daily[0]?.condition).toBe('good');
  });

  it('falls back to the day high/low when daylight data is missing', () => {
    const data = makeOpenMeteoData({
      daily: {
        time: ['2024-01-15'],
        sunrise: [undefined] as unknown as string[],
        sunset: [undefined] as unknown as string[],
        temperature_2m_min: [20], // deep-cold overnight low, in range for 'bad'
        temperature_2m_max: [70],
      },
    });

    const weather = buildWeatherFromData(data, THRESHOLDS);

    expect(weather.daily[0]?.condition).toBe('bad');
  });

  it('stores metrics from the best contiguous three-hour daylight window', () => {
    const hours = Array.from({ length: 7 }, (_, i) => hourTime('2024-01-20', i + 7));
    const data = makeOpenMeteoData({
      current: { time: hours[0] },
      hourly: {
        time: hours,
        wind_speed_10m: [25, 25, 25, 5, 5, 5, 25],
        wind_gusts_10m: [35, 35, 35, 10, 10, 10, 35],
        precipitation_probability: [70, 70, 70, 5, 5, 5, 70],
      },
      daily: {
        time: ['2024-01-20'],
        sunrise: [hourTime('2024-01-20', 7)],
        sunset: [hourTime('2024-01-20', 14)],
      },
    });

    const weather = buildWeatherFromData(data, THRESHOLDS);
    const day = weather.daily[0];

    expect(day?.condition).toBe('good');
    expect(day?.rideWindow).toMatchObject({ startHour: 10, endHour: 13 });
    expect(day?.windSpeed).toBe(5);
    expect(day?.windGust).toBe(10);
    expect(day?.rainChance).toBe(5);
  });

  it('does not select a best window that has already passed today', () => {
    const hours = Array.from({ length: 9 }, (_, i) => hourTime('2024-01-20', i + 7));
    const data = makeOpenMeteoData({
      current: { time: hourTime('2024-01-20', 10) },
      hourly: {
        time: hours,
        wind_speed_10m: [5, 5, 5, 18, 18, 18, 18, 18, 18],
      },
      daily: {
        time: ['2024-01-20'],
        sunrise: [hourTime('2024-01-20', 7)],
        sunset: [hourTime('2024-01-20', 16)],
      },
    });

    const weather = buildWeatherFromData(data, THRESHOLDS);

    expect(weather.daily[0]?.rideWindow?.startHour).toBe(10);
    expect(weather.daily[0]?.condition).toBe('marginal');
  });

  it('does not create a shortened ride window when fewer than three daylight hours remain', () => {
    const hours = Array.from({ length: 9 }, (_, i) => hourTime('2024-01-20', i + 7));
    const data = makeOpenMeteoData({
      current: { time: hourTime('2024-01-20', 14) },
      hourly: { time: hours },
      daily: {
        time: ['2024-01-20'],
        sunrise: [hourTime('2024-01-20', 7)],
        sunset: [hourTime('2024-01-20', 16)],
      },
    });

    const weather = buildWeatherFromData(data, THRESHOLDS);

    expect(weather.daily[0]?.rideWindow).toBeUndefined();
    expect(weather.daily[0]?.rideWindowUnavailable).toBe(true);
  });
});

describe('buildWeatherFromData — sparse optional fields', () => {
  it('tolerates missing optional arrays and null per-hour readings', () => {
    const hours = Array.from({ length: 24 }, (_, h) => hourTime('2024-01-20', h));
    // Descending daytime temps also exercise the running min/max range tracking.
    const temps = hours.map((_, h) => 75 - h);
    const data = makeOpenMeteoData({
      current: { time: hours[0] },
      hourly: {
        time: hours,
        temperature_2m: temps,
        weather_code: hours.map(() => null) as unknown as number[],
        dewpoint_2m: hours.map(() => null) as unknown as number[],
        // Null rain only pre-dawn: daylight hours must keep readings so a ride
        // window can still be selected.
        precipitation_probability: hours.map((_, h) => (h === 0 ? null : 5)) as unknown as number[],
      },
      daily: {
        time: ['2024-01-20'],
        sunrise: [hourTime('2024-01-20', 7)],
        sunset: [hourTime('2024-01-20', 18)],
      },
    });
    delete data.hourly.wind_gusts_10m;
    delete data.hourly.uv_index;

    const weather = buildWeatherFromData(data, THRESHOLDS);

    expect(weather.hourly).toHaveLength(24);
    expect(weather.hourly[0]).toMatchObject({
      windGust: null,
      dewpoint: null,
      weatherCode: null,
      rainChance: 0,
      uv: 0,
    });
    expect(weather.daily[0]?.rideWindow).toBeDefined();
  });

  it('derives the current hour from the payload UTC offset when current.time is absent', () => {
    const data = makeOpenMeteoData({
      current: { time: undefined as unknown as string },
    });
    delete data.utc_offset_seconds;

    const weather = buildWeatherFromData(data, THRESHOLDS);

    expect(weather.temperature).toBe(60);
    expect(Array.isArray(weather.hourly)).toBe(true);
  });
});

describe('buildWeatherFromData — daylight (sunrise/sunset) extraction', () => {
  it('reads sunrise/sunset hours from day 0', () => {
    const data = makeOpenMeteoData({
      daily: {
        time: ['2024-01-15'],
        sunrise: [hourTime('2024-01-15', 6)],
        sunset: [hourTime('2024-01-15', 19)],
      },
    });

    const weather = buildWeatherFromData(data, THRESHOLDS);

    expect(weather.daylight).toEqual({ sunriseHour: 6, sunsetHour: 19 });
  });

  it('returns null when sunrise/sunset are missing', () => {
    const data = makeOpenMeteoData({
      daily: {
        time: ['2024-01-15'],
        sunrise: [undefined] as unknown as string[],
        sunset: [undefined] as unknown as string[],
      },
    });

    const weather = buildWeatherFromData(data, THRESHOLDS);

    expect(weather.daylight).toBeNull();
  });
});
