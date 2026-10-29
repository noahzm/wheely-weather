// Deterministic fixture data for UI testing without hitting the live API.
// Activate with `?mock=ride`, `?mock=maybe`, `?mock=rest`, `?mock=alert`, or `?mock=wait`.

import { ALL_DAY_RIDE_HOURS } from '../domain/ride-window';
import {
  getHourlyCondition,
  getDailyCondition,
  getWeatherDescription,
  isThunderstorm,
} from '../domain/weather';

import type {
  Condition,
  DaylightHour,
  HourlyWeather,
  MockScenario,
  Weather,
  WeatherAlert,
} from '@/types/weather';

interface MockScenarioSpec {
  label: string;
  current: {
    temperature?: number;
    feelsLike: number;
    windSpeed: number;
    windGust: number;
    windDirection: number;
    rainChance: number;
    weatherCode: number;
    dewpoint: number;
    aqi: number;
    uvIndex: number;
    uvIndexDailyMax: number;
  };
  hourTemplate: (
    h: number,
    nowHour: number,
  ) => {
    temperature?: number;
    feelsLike: number;
    windSpeed: number;
    windGust: number;
    rainChance: number;
    dewpoint: number;
    weatherCode: number;
    uv: number;
  };
  dayTemplate: (i: number) => {
    high: number;
    low: number;
    windSpeed: number;
    windGust: number;
    rainChance: number;
    weatherCode: number;
  };
  sunrise: string;
  sunset: string;
  sunriseHour: number;
  sunsetHour: number;
  nwsAlerts: WeatherAlert[];
  /** Today's best ride window, as hour offsets from now; omitted, the verdict rates current conditions. */
  todayWindow?: { startOffset: number; hours: number; tempLow: number; tempHigh: number };
}

/** Hours from `nowHour` until `h` (0–23), for templates keyed to the current time. */
const hoursFromNow = (h: number, nowHour: number): number => (h - nowHour + 24) % 24;

/** Narrows an arbitrary value to a known mock scenario name. */
export function isMockScenario(value: unknown): value is MockScenario {
  return typeof value === 'string' && value in SCENARIOS;
}

const SCENARIOS: Record<MockScenario, MockScenarioSpec> = {
  ride: {
    label: 'Ride Day',
    current: {
      temperature: 64,
      feelsLike: 68,
      windSpeed: 6,
      windGust: 11,
      windDirection: 220,
      rainChance: 0,
      weatherCode: 1,
      dewpoint: 52,
      aqi: 28,
      uvIndex: 2,
      uvIndexDailyMax: 4,
    },
    hourTemplate: (h) => ({
      temperature: 56 + 10 * Math.sin(((h - 6) * Math.PI) / 12),
      feelsLike: 60 + 12 * Math.sin(((h - 6) * Math.PI) / 12),
      windSpeed: 5 + (h % 4),
      windGust: 11 + (h % 4),
      rainChance: 0,
      dewpoint: 50,
      weatherCode: h < 18 && h > 6 ? 1 : 2,
      uv: Math.max(0, 2 * Math.sin(((h - 6) * Math.PI) / 12)),
    }),
    dayTemplate: (i) => ({
      high: 74 + (i % 3),
      low: 54 + (i % 4),
      windSpeed: 7,
      windGust: 12,
      rainChance: 5,
      weatherCode: 1,
    }),
    sunrise: '6:30 AM',
    sunset: '7:45 PM',
    sunriseHour: 6,
    sunsetHour: 19,
    nwsAlerts: [],
  },
  maybe: {
    label: 'Mixed Conditions',
    current: {
      temperature: 82,
      feelsLike: 88,
      windSpeed: 14,
      windGust: 22,
      windDirection: 90,
      rainChance: 35,
      weatherCode: 61,
      dewpoint: 66,
      aqi: 95,
      uvIndex: 7,
      uvIndexDailyMax: 9,
    },
    hourTemplate: (h) => ({
      temperature: 74 + 8 * Math.sin(((h - 6) * Math.PI) / 12),
      feelsLike: 78 + 10 * Math.sin(((h - 6) * Math.PI) / 12),
      windSpeed: 12 + (h % 5),
      windGust: 21 + (h % 5),
      rainChance: h > 14 && h < 20 ? 55 : 25,
      dewpoint: 65,
      weatherCode: h > 14 && h < 20 ? 61 : 3,
      uv: Math.max(0, 7 * Math.sin(((h - 6) * Math.PI) / 12)),
    }),
    dayTemplate: (i) => ({
      high: 86 + (i % 4),
      low: 68 + (i % 3),
      windSpeed: 13,
      windGust: 20,
      rainChance: 40,
      weatherCode: i % 2 === 0 ? 61 : 3,
    }),
    sunrise: '6:15 AM',
    sunset: '8:05 PM',
    sunriseHour: 6,
    sunsetHour: 20,
    nwsAlerts: [],
  },
  rest: {
    label: 'Rest Day',
    current: {
      feelsLike: 34,
      windSpeed: 24,
      windGust: 38,
      windDirection: 320,
      rainChance: 85,
      weatherCode: 65,
      dewpoint: 32,
      aqi: 160,
      uvIndex: 1,
      uvIndexDailyMax: 2,
    },
    hourTemplate: (h) => ({
      feelsLike: 30 + 6 * Math.sin(((h - 6) * Math.PI) / 12),
      windSpeed: 22 + (h % 6),
      windGust: 34 + (h % 6),
      rainChance: 80,
      dewpoint: 30,
      weatherCode: 65,
      uv: Math.max(0, 1.5 * Math.sin(((h - 6) * Math.PI) / 12)),
    }),
    dayTemplate: (i) => ({
      high: 38 + (i % 3),
      low: 28 + (i % 4),
      windSpeed: 22,
      windGust: 36,
      rainChance: 75,
      weatherCode: 65,
    }),
    sunrise: '7:10 AM',
    sunset: '5:25 PM',
    sunriseHour: 7,
    sunsetHour: 17,
    nwsAlerts: [],
  },
  alert: {
    label: 'Severe Weather',
    current: {
      feelsLike: 82,
      windSpeed: 18,
      windGust: 30,
      windDirection: 180,
      rainChance: 90,
      weatherCode: 95,
      dewpoint: 72,
      aqi: 110,
      uvIndex: 2,
      uvIndexDailyMax: 8,
    },
    hourTemplate: (h) => ({
      feelsLike: 76 + 6 * Math.sin(((h - 6) * Math.PI) / 12),
      windSpeed: 16 + (h % 5),
      windGust: 26 + (h % 5),
      rainChance: 80,
      dewpoint: 71,
      weatherCode: h >= 12 && h <= 18 ? 95 : 61,
      uv: Math.max(0, 4 * Math.sin(((h - 6) * Math.PI) / 12)),
    }),
    dayTemplate: (i) => ({
      high: 84,
      low: 70,
      windSpeed: 17,
      windGust: 28,
      rainChance: 70,
      weatherCode: i === 0 ? 95 : 61,
    }),
    sunrise: '6:20 AM',
    sunset: '7:55 PM',
    sunriseHour: 6,
    sunsetHour: 19,
    nwsAlerts: [
      {
        type: 'nws',
        icon: 'default',
        severity: 'extreme',
        event: 'Severe Thunderstorm Warning',
        headline: 'Severe thunderstorms with damaging winds and large hail expected.',
        instruction:
          'Move to a sturdy shelter on the lowest floor of a building. Stay away from windows.',
        expires: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
      },
    ],
  },
  wait: {
    label: 'Wait For It',
    current: {
      temperature: 58,
      feelsLike: 56,
      windSpeed: 9,
      windGust: 16,
      windDirection: 200,
      rainChance: 95,
      weatherCode: 63,
      dewpoint: 55,
      aqi: 22,
      uvIndex: 1,
      uvIndexDailyMax: 5,
    },
    // Rain for the next three hours, then clearing and warming.
    hourTemplate: (h, nowHour) => {
      const wet = hoursFromNow(h, nowHour) < 3;
      return {
        temperature: wet ? 58 : 67,
        feelsLike: wet ? 56 : 67,
        windSpeed: wet ? 9 : 6,
        windGust: wet ? 16 : 10,
        rainChance: wet ? 95 : 5,
        dewpoint: wet ? 55 : 50,
        weatherCode: wet ? 63 : 1,
        uv: wet ? 1 : 4,
      };
    },
    dayTemplate: (i) => ({
      high: 70 + (i % 3),
      low: 55,
      windSpeed: 6,
      windGust: 10,
      rainChance: 5,
      weatherCode: 1,
    }),
    sunrise: '7:05 AM',
    sunset: '7:10 PM',
    sunriseHour: 7,
    sunsetHour: 19,
    nwsAlerts: [],
    todayWindow: { startOffset: 3, hours: 3, tempLow: 66, tempHigh: 68 },
  },
};

/** Display label for the active scenario (used to override the location name). */
export function getMockLocationLabel(scenario: string | null | undefined): string | null {
  const s = isMockScenario(scenario) ? SCENARIOS[scenario] : null;
  return s ? `Mock: ${s.label}` : null;
}

function buildDayRideWindow(params: {
  dayIndex: number;
  nowHour: number;
  spec: MockScenarioSpec;
  condition: string;
  day: { low: number; high: number };
  windowHours: number;
  nightRiding: boolean;
}) {
  const { dayIndex, nowHour, spec, condition, day, windowHours, nightRiding } = params;
  const { todayWindow } = spec;
  if (dayIndex === 0 && todayWindow) {
    const startHour = (nowHour + todayWindow.startOffset) % 24;
    const dayEnd = nightRiding ? 24 : spec.sunsetHour;
    const span =
      windowHours >= ALL_DAY_RIDE_HOURS
        ? Math.max(todayWindow.hours, dayEnd - startHour)
        : windowHours;
    // Clamp at 24 rather than wrapping modulo 24: `endHour < startHour` breaks
    // `[startHour, endHour)` range matching in the chart and kit guide.
    return {
      startHour,
      endHour: Math.min(24, startHour + span),
      tempLow: todayWindow.tempLow,
      tempHigh: todayWindow.tempHigh,
    };
  }
  if (dayIndex >= 2 && condition !== 'bad' && condition !== 'poor') {
    const minStart = nightRiding ? 0 : spec.sunriseHour;
    const maxEnd = nightRiding ? 24 : spec.sunsetHour;
    const availableSpan = maxEnd - minStart;
    const span =
      windowHours >= ALL_DAY_RIDE_HOURS ? availableSpan : Math.min(windowHours, availableSpan);
    const startHour =
      windowHours >= ALL_DAY_RIDE_HOURS
        ? minStart
        : Math.max(minStart, Math.min(12, maxEnd - span));
    return {
      startHour,
      endHour: Math.min(maxEnd, startHour + span),
      tempLow: day.low + 4,
      tempHigh: day.high - 2,
    };
  }
}

/**
 * A mock day's strip. Today's hours come from the same template as the mock
 * chart; later days have no hourly template (some scenarios' are keyed to the
 * current time), so every hour carries the day's own rating rather than an
 * invented shape. None once today's rideable hours are over.
 */
function buildMockDaylight(params: {
  dayIndex: number;
  spec: MockScenarioSpec;
  nowHour: number;
  condition: Condition;
  todayHour: (h: number) => HourlyWeather;
  nightRiding: boolean;
}): DaylightHour[] | undefined {
  const { dayIndex, spec, nowHour, condition, todayHour, nightRiding } = params;
  const startHour = nightRiding ? 0 : spec.sunriseHour;
  const endHour = nightRiding ? 24 : spec.sunsetHour;
  const hours: DaylightHour[] = [];
  for (let h = startHour; h < endHour; h++) {
    if (dayIndex === 0) {
      hours.push({
        hour: h,
        condition: todayHour(h).condition,
        ...(h < nowHour && { isPast: true }),
      });
    } else {
      hours.push({ hour: h, condition });
    }
  }
  return hours.some((h) => !h.isPast) ? hours : undefined;
}

/** Builds the full normalized weather payload for the given scenario. */
export function buildMockWeather(
  scenario: string | null | undefined,
  windowHours = 3,
  nightRiding = false,
): Weather | null {
  const spec = isMockScenario(scenario) ? SCENARIOS[scenario] : null;
  if (!spec) return null;

  const nowHour = new Date().getHours();

  const buildHour = (absHour: number): HourlyWeather => {
    const h = ((absHour % 24) + 24) % 24;
    const t = spec.hourTemplate(h, nowHour);
    const temperature = t.temperature ?? t.feelsLike;
    return {
      hour: h,
      temperature,
      feelsLike: t.feelsLike,
      windSpeed: t.windSpeed,
      windGust: t.windGust,
      rainChance: t.rainChance,
      dewpoint: t.dewpoint,
      weatherCode: t.weatherCode,
      uv: t.uv,
      condition: getHourlyCondition({
        temperature,
        wind: t.windSpeed,
        gust: t.windGust,
        rain: t.rainChance,
        code: t.weatherCode,
        dewpoint: t.dewpoint,
      }),
    };
  };

  const hourly = Array.from({ length: 24 }, (_, i) => buildHour(nowHour + i));
  const pastHourly = Array.from({ length: 12 }, (_, i) => buildHour(nowHour - 12 + i));

  const today = new Date();
  const daily = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    d.setHours(12, 0, 0, 0);
    const t = spec.dayTemplate(i);
    const condition = getDailyCondition({
      tempLow: t.low,
      tempHigh: t.high,
      wind: t.windSpeed,
      gust: t.windGust,
      rain: t.rainChance,
      code: t.weatherCode,
      dewpoint: spec.current.dewpoint,
    });
    const rideWindow = buildDayRideWindow({
      dayIndex: i,
      nowHour,
      spec,
      condition,
      day: t,
      windowHours,
      nightRiding,
    });
    const daylight = buildMockDaylight({
      dayIndex: i,
      spec,
      nowHour,
      condition,
      todayHour: buildHour,
      nightRiding,
    });
    return {
      ...(rideWindow && { rideWindow }),
      ...(daylight && { daylight }),
      date: d,
      high: t.high,
      low: t.low,
      windSpeed: t.windSpeed,
      windGust: t.windGust,
      rainChance: t.rainChance,
      weatherCode: t.weatherCode,
      condition,
    };
  });

  const c = spec.current;
  return {
    temperature: c.temperature ?? c.feelsLike,
    feelsLike: c.feelsLike,
    windSpeed: c.windSpeed,
    windGust: c.windGust,
    windDirection: c.windDirection,
    rainChance: c.rainChance,
    weatherCode: c.weatherCode,
    hasThunderstorms: isThunderstorm(c.weatherCode),
    condition: getWeatherDescription(c.weatherCode),
    dewpoint: c.dewpoint,
    aqi: c.aqi,
    uvIndex: c.uvIndex,
    uvIndexDailyMax: c.uvIndexDailyMax,
    hourly,
    pastHourly,
    daily,
    sunrise: spec.sunrise,
    sunset: spec.sunset,
    daylight: { sunriseHour: spec.sunriseHour, sunsetHour: spec.sunsetHour },
    nwsAlerts: spec.nwsAlerts,
  };
}
