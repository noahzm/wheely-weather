import {
  formatIssuesAsSentence,
  getRideVerdict,
  getRideVerdictLabel,
  type RideVerdict,
} from '@/domain';
import { applyAirQualityToToday } from '@/domain/air-quality';
import type { Thresholds } from '@/domain/constants';
import { getVerdictSky, type Sky } from '@/domain/weather-codes';
import type { ForecastSnapshot } from '@/services/forecastSnapshot';
import { buildWeatherFromData, forecastFromHour } from '@/services/weatherParsing';
import { DEFAULT_NIGHT_RIDING, DEFAULT_RIDE_DURATION, RIDE_DURATION_HOURS } from '@/types/settings';
import type { Condition, RideStatus, Weather } from '@/types/weather';

import { formatTemperature, type TempUnit } from '@/utils/temperature';
import { weatherSfSymbol } from '@/utils/weatherSymbols';

/** One verdict as the widget shows it. */
interface WidgetVerdict {
  status: RideStatus;
  /** The rating behind `status`, so the widget's color matches the card. */
  condition: Condition;
  headline: string;
  detail: string;
  temperature: string;
  symbol: string;
  /** Bad now but good later today, so the widget uses the wait color. */
  waiting: boolean;
  /** The home screen's sky for this verdict, painted behind the widget; null keeps the plain page. */
  sky: Sky | null;
}

/** A verdict the widget switches to at `at` (ISO 8601). */
export interface UpcomingVerdict extends WidgetVerdict {
  at: string;
  /**
   * That hour rated on its own, for the medium widget's hour strip. The
   * verdict fields rate the day's best window as of that hour, so they can't
   * say how the hour itself is.
   */
  hourCondition: Condition | null;
}

/**
 * What the iOS home screen widget shows. The widget can't run the TypeScript
 * scoring, so the app rates the forecast and hands over display-ready strings.
 * Field names are decoded by `targets/widget/WheelyWidget.swift` — keep in sync.
 */
export interface WidgetSnapshot extends WidgetVerdict {
  location: string;
  /** Following the device's location, so the widget shows the location arrow. */
  isCurrentLocation: boolean;
  /** When the forecast was fetched (ISO 8601), so the widget can flag stale data. */
  updatedAt: string;
  /**
   * The verdict for each of the next hours, rated from this same forecast as
   * the app would rate it then. The widget only updates when the app runs, so
   * without these a morning check left it gray from mid-morning on. Empty for a
   * snapshot restored from disk, which has no raw forecast to re-rate.
   */
  upcoming: UpcomingVerdict[];
}

/** How many hours ahead the widget's timeline reaches. */
export const WIDGET_HOURS_AHEAD = 12;
const HOUR_MS = 60 * 60 * 1000;

/** The one line of reasoning a small widget has room for. */
function widgetDetail(verdict: RideVerdict): string {
  const { status, message, rated } = verdict;
  // Waiting, the headline already says when ("Wait till 2 PM"), so the line
  // says why ("Now: rain expected (90%)"). Otherwise: when to go if the best
  // window isn't now ("Best 2 PM–5 PM", "Tomorrow 9 AM–12 PM"), else the sky on
  // a ride day, else what's wrong.
  if (message.now) return `Now: ${message.now.charAt(0).toLowerCase()}${message.now.slice(1)}`;
  if (message.timing) return message.timing;
  return status === 'yes'
    ? rated.condition
    : formatIssuesAsSentence(message.issues) || message.lead;
}

function buildVerdict(
  weather: Weather,
  location: string,
  thresholds: Thresholds,
  tempUnit: TempUnit,
): WidgetVerdict {
  const verdict = getRideVerdict(weather, thresholds, tempUnit);
  return {
    status: verdict.status,
    condition: verdict.condition,
    headline: getRideVerdictLabel(verdict, location),
    detail: widgetDetail(verdict),
    temperature: formatTemperature(weather.temperature, tempUnit),
    symbol: weatherSfSymbol(verdict.weatherCode),
    waiting: verdict.when === 'wait',
    sky: getVerdictSky(verdict.status, verdict.when === 'wait', verdict.weatherCode),
  };
}

/**
 * The snapshot's forecast as it will read at each of the next `hours` hours
 * (`forecastFromHour`), with today's AQI carried over as the snapshot has it.
 * Entry `k` starts `k` hours after the top of the fetch hour: exact for
 * whole-hour UTC offsets, up to 30 minutes off in a half-hour zone.
 */
export function upcomingForecasts(
  snapshot: ForecastSnapshot,
  hours: number = WIDGET_HOURS_AHEAD,
): { at: Date; weather: Weather }[] {
  const data = snapshot.forecastData;
  if (!data) return [];
  const { thresholds } = snapshot.acclimatization;
  const windowHours = RIDE_DURATION_HOURS[snapshot.rideDuration ?? DEFAULT_RIDE_DURATION];
  const nightRiding = snapshot.nightRiding ?? DEFAULT_NIGHT_RIDING;
  const { aqi, nwsAlerts } = snapshot.weather;
  const topOfHour = new Date(snapshot.lastUpdated);
  topOfHour.setMinutes(0, 0, 0);
  const upcoming: { at: Date; weather: Weather }[] = [];
  for (let k = 1; k <= hours; k++) {
    const later = forecastFromHour(data, k);
    if (!later) break;
    const weather = applyAirQualityToToday(
      { ...buildWeatherFromData(later, thresholds, windowHours, nightRiding), aqi, nwsAlerts },
      thresholds,
    );
    upcoming.push({ at: new Date(topOfHour.getTime() + k * HOUR_MS), weather });
  }
  return upcoming;
}

/** Builds the widget payload, mirroring the home screen's verdict card. Mock previews return null. */
export function buildWidgetSnapshot(
  snapshot: ForecastSnapshot,
  tempUnit: TempUnit,
): WidgetSnapshot | null {
  if (snapshot.mockScenario) return null;
  const { weather, location } = snapshot;
  const { thresholds } = snapshot.acclimatization;
  return {
    ...buildVerdict(weather, location, thresholds, tempUnit),
    location,
    isCurrentLocation: snapshot.isDeviceLocation,
    updatedAt: snapshot.lastUpdated.toISOString(),
    upcoming: upcomingForecasts(snapshot).map(({ at, weather: later }) => ({
      at: at.toISOString(),
      ...buildVerdict(later, location, thresholds, tempUnit),
      // The forecast's first hour is the one starting at `at`.
      hourCondition: later.hourly[0]?.condition ?? null,
    })),
  };
}
