import { formatIssuesAsSentence, getRideVerdict, getVerdictLabel } from '@/domain';
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
  const { status, message, rated } = getRideVerdict(weather, thresholds, tempUnit);
  const issues = formatIssuesAsSentence(message.issues);
  // A small widget has room for one line of reasoning: when to go if the best
  // window isn't now ("Best 2 PM–5 PM", "Tomorrow 9 AM–12 PM"), else the sky on
  // a ride day, else what's wrong.
  const detail = message.timing ?? (status === 'yes' ? rated.condition : issues || message.lead);
  return {
    status,
    headline: getVerdictLabel(status, location),
    detail,
    temperature: formatTemperature(weather.temperature, tempUnit),
    symbol: weatherSfSymbol(rated.weatherCode),
    location,
    isCurrentLocation: snapshot.isDeviceLocation,
    updatedAt: snapshot.lastUpdated.toISOString(),
  };
}
