import { getLocales } from 'expo-localization';

import { loadCachedForecast, saveCachedForecast } from '@/services/forecastCache';
import { getForecastSnapshot } from '@/services/forecastSnapshot';
import { loadAllSettings, loadSavedLocation } from '@/services/locationStorage';
import { publishWidgetSnapshot } from '@/services/widgetStorage';
import type { TempUnit } from '@/utils/temperature';
import { buildWidgetSnapshot } from '@/utils/widgetSnapshot';

import { applyExtras } from './merge-extras';

/**
 * A forecast younger than this is left alone: the app (or an earlier run)
 * already refreshed the widget from it.
 */
export const BACKGROUND_REFRESH_MIN_AGE_MS = 30 * 60 * 1000;

export type BackgroundRefreshOutcome = 'refreshed' | 'fresh' | 'no-location';

/**
 * What iOS wakes the app for every few hours (register-background-refresh):
 * fetch the forecast for the place the app last showed, then rewrite the
 * widget and the forecast cache, so the widget rates a current forecast
 * instead of one from the last time the app was opened. No GPS: background
 * location would need the "Always" permission, so a rider following their
 * device gets their last fix. Rejects only if the forecast fetch fails.
 */
export async function refreshWidgetInBackground(
  now: number = Date.now(),
): Promise<BackgroundRefreshOutcome> {
  const [settings, savedLocation, cached] = await Promise.all([
    loadAllSettings(),
    loadSavedLocation(),
    loadCachedForecast(),
  ]);
  if (!savedLocation) return 'no-location';
  if (cached && now - cached.snapshot.lastUpdated.getTime() < BACKGROUND_REFRESH_MIN_AGE_MS) {
    return 'fresh';
  }

  const { snapshot, extras } = await getForecastSnapshot({
    savedLocation,
    homeLocation: settings.homeLocation,
    exposureLevel: settings.exposureLevel,
    rideDuration: settings.rideDuration,
  });
  // Nobody is waiting on first paint here, so take the alerts and AQI too.
  const complete = applyExtras(snapshot, await extras) ?? snapshot;
  // The snapshot was fetched for `savedLocation`, so the pair is safe to cache.
  await saveCachedForecast(complete, savedLocation);

  const tempUnit: TempUnit =
    settings.tempUnit === 'auto'
      ? (getLocales()[0].temperatureUnit ?? 'fahrenheit')
      : settings.tempUnit;
  const widget = buildWidgetSnapshot(complete, tempUnit);
  if (widget) publishWidgetSnapshot(widget);
  return 'refreshed';
}
