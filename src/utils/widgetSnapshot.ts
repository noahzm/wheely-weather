import { formatIssuesAsSentence, getRideVerdict, getRideVerdictLabel } from '@/domain';
import type { ForecastSnapshot } from '@/services/forecastSnapshot';
import type { RideStatus } from '@/types/weather';

import { formatTemperature, type TempUnit } from './temperature';
import { weatherSfSymbol } from './weatherSymbols';

/**
 * What the iOS home screen widget shows. The widget can't run the TypeScript
 * scoring, so the app rates the forecast and hands over display-ready strings.
 * Field names are decoded by `targets/widget/WheelyWidget.swift` — keep in sync.
 */
export interface WidgetSnapshot {
  status: RideStatus;
  headline: string;
  detail: string;
  temperature: string;
  symbol: string;
  location: string;
  /** Bad now but good later today, so the widget uses the wait color. */
  waiting: boolean;
  /** Following the device's location, so the widget shows the location arrow. */
  isCurrentLocation: boolean;
  /** When the forecast was fetched (ISO 8601), so the widget can flag stale data. */
  updatedAt: string;
}

/** Builds the widget payload, mirroring the home screen's verdict card. Mock previews return null. */
export function buildWidgetSnapshot(
  snapshot: ForecastSnapshot,
  tempUnit: TempUnit,
): WidgetSnapshot | null {
  if (snapshot.mockScenario) return null;
  const { weather, location } = snapshot;
  const { thresholds } = snapshot.acclimatization;
  const verdict = getRideVerdict(weather, thresholds, tempUnit);
  const { status, message, rated } = verdict;
  // A small widget has room for one line of reasoning. Waiting, the headline
  // already says when ("Wait till 2 PM"), so the line says why ("Now: rain
  // expected (90%)"). Otherwise: when to go if the best window isn't now ("Best
  // 2 PM–5 PM", "Tomorrow 9 AM–12 PM"), else the sky on a ride day, else what's wrong.
  let detail = message.now
    ? `Now: ${message.now.charAt(0).toLowerCase()}${message.now.slice(1)}`
    : message.timing;
  detail ??=
    status === 'yes' ? rated.condition : formatIssuesAsSentence(message.issues) || message.lead;
  return {
    status,
    headline: getRideVerdictLabel(verdict, location),
    waiting: verdict.when === 'wait',
    detail,
    temperature: formatTemperature(weather.temperature, tempUnit),
    symbol: weatherSfSymbol(verdict.weatherCode),
    location,
    isCurrentLocation: snapshot.isDeviceLocation,
    updatedAt: snapshot.lastUpdated.toISOString(),
  };
}
