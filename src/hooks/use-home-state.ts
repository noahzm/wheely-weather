import { useState } from 'react';

import {
  getCustomKitTitle,
  getDaylightWarning,
  getRainTiming,
  getRideKitTitle,
  getRideVerdict,
  getRideVerdictLabel,
  getWeatherAlerts,
  rideHoursFromIndex,
  type RideHours,
} from '@/domain';
import { useRideDuration } from '@/hooks/settings-context';
import type { AcclimatizationContext } from '@/services/forecastSnapshot';
import { RIDE_DURATION_HOURS, type RideDuration } from '@/types/settings';
import type { HourlyWeather, Weather } from '@/types/weather';
import { chartWindowIndexes } from '@/utils/hourlyChart';
import type { TempUnit } from '@/utils/temperature';
import { fullHourLabel } from '@/utils/timeFormat';

export function deriveHomeState(
  weather: Weather,
  location: string,
  acclimatization: AcclimatizationContext,
  tempUnit: TempUnit,
  rideDuration?: RideDuration,
) {
  const { thresholds } = acclimatization;
  // Rates the day's best ride window (tomorrow's after dark), not this hour.
  const verdict = getRideVerdict(weather, thresholds, tempUnit);
  const windowWithDay: RideHours | null = verdict.window
    ? { ...verdict.window, tomorrow: verdict.when === 'tomorrow' }
    : null;
  // Shaded on the chart when it's a recommendation; the best of a no-go day isn't.
  const rideWindow = verdict.status === 'no' ? null : windowWithDay;
  return {
    status: verdict.status,
    condition: verdict.condition,
    score: verdict.score,
    message: verdict.message,
    label: getRideVerdictLabel(verdict, location),
    verdictWeatherCode: verdict.weatherCode,
    waiting: verdict.when === 'wait',
    rideWindow,
    // Dress for the window the verdict rates, not the current hour.
    kit: {
      title: getRideKitTitle(verdict),
      weather: verdict.rated,
      rideHours: windowWithDay,
      thresholds,
      rideDuration,
    },
    rainTiming: getRainTiming(weather.hourly),
    daylightWarning: getDaylightWarning(weather.hourly, weather.daylight, rideWindow),
    alerts: getWeatherAlerts(weather, tempUnit),
  };
}

export type HomeState = ReturnType<typeof deriveHomeState>;

export interface HomeSectionsData {
  weather: Weather;
  thresholds: AcclimatizationContext['thresholds'];
  derived: HomeState;
}

function isHourlyIndexTomorrow(hourly: HourlyWeather[], targetIdx: number): boolean {
  let prevHour: number | null = null;
  for (const h of hourly.slice(0, targetIdx + 1)) {
    if (prevHour !== null && h.hour < prevHour) return true;
    prevHour = h.hour;
  }
  return false;
}

export function weatherAtHour(
  weather: Weather,
  hour: HourlyWeather | undefined,
  isTomorrow = false,
): Weather {
  if (!hour) return weather;
  return {
    ...weather,
    temperature: hour.temperature,
    feelsLike: hour.feelsLike,
    windSpeed: hour.windSpeed,
    windGust: hour.windGust,
    windDirection: undefined,
    rainChance: hour.rainChance,
    precipitation: hour.precipitation,
    dewpoint: hour.dewpoint ?? weather.dewpoint,
    aqi: isTomorrow ? (hour.aqi ?? null) : (hour.aqi ?? weather.aqi),
    uvIndex: hour.uv ?? weather.uvIndex,
    weatherCode: hour.weatherCode,
    condition: hour.condition,
  };
}

/** Tracks custom hour selection on the hourly chart and updates the kit, daylight warning, and specs. */
export function useSelectedHomeKit(weather: Weather, derived: HomeState, placeKey: string) {
  const [settingRideDuration] = useRideDuration();
  const activeRideDuration = derived.kit.rideDuration ?? settingRideDuration;
  const kitResetKey = `${placeKey}|${derived.rideWindow?.startHour ?? ''}|${derived.rideWindow?.endHour ?? ''}|${activeRideDuration}`;
  const [selectedHourlyIdx, setSelectedHourlyIdx] = useState<number | null>(null);
  const [shownKitKey, setShownKitKey] = useState(kitResetKey);
  if (shownKitKey !== kitResetKey) {
    setShownKitKey(kitResetKey);
    setSelectedHourlyIdx(null);
  }

  const windowHours = RIDE_DURATION_HOURS[activeRideDuration];
  const customRideHours =
    selectedHourlyIdx === null
      ? null
      : rideHoursFromIndex(weather.hourly, selectedHourlyIdx, windowHours);
  const activeKit: HomeState['kit'] = customRideHours
    ? {
        ...derived.kit,
        title: getCustomKitTitle(weather, customRideHours, windowHours),
        weather,
        rideHours: customRideHours,
      }
    : derived.kit;
  const activeDaylightWarning = customRideHours
    ? getDaylightWarning(weather.hourly, weather.daylight, customRideHours)
    : derived.daylightWarning;

  const openingHourlyIdx =
    chartWindowIndexes(
      weather.hourly.slice(0, 24).map((h, idx) => ({ idx, hour: h.hour, isPast: false })),
      derived.rideWindow,
    )?.first ?? 0;
  const activeHourlyIdx = selectedHourlyIdx ?? openingHourlyIdx;
  const selectedHour = activeHourlyIdx > 0 ? weather.hourly[activeHourlyIdx] : undefined;
  const activeSpecs = {
    title: selectedHour ? `At ${fullHourLabel(selectedHour.hour)}` : 'Right now',
    weather: weatherAtHour(
      weather,
      selectedHour,
      selectedHour ? isHourlyIndexTomorrow(weather.hourly, activeHourlyIdx) : false,
    ),
  };

  return { activeKit, activeDaylightWarning, activeSpecs, setSelectedHourlyIdx };
}
