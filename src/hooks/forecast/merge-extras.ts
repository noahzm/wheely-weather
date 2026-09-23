import type { Dispatch, SetStateAction } from 'react';

import { applyAirQualityToToday } from '@/domain/air-quality';
import type { ForecastSnapshot } from '@/services/forecastSnapshot';
import type { ForecastExtras } from '@/types/weather';

import type { ForecastState } from './load-forecast-data';

/**
 * Patches AQI/NWS alerts into the snapshot once the (non-blocking) extras
 * fetch settles, re-rating today's hours with the AQI. The snapshot-identity guard drops the merge for free when a
 * newer load has replaced it in the meantime. `onMerged` receives the patched
 * snapshot so the caller can persist it alongside the location it belongs to.
 */
export function mergeExtrasWhenReady(
  snapshot: ForecastSnapshot,
  extras: Promise<ForecastExtras | null>,
  setState: Dispatch<SetStateAction<ForecastState>>,
  onMerged?: (merged: ForecastSnapshot) => void,
): void {
  void extras.then((patch) => {
    // Skip empty patches so a fetch that found nothing doesn't churn state.
    if (!patch || (patch.aqi === null && patch.nwsAlerts.length === 0)) return;
    // Rated with the snapshot's own thresholds, like the rest of its hours.
    const weather = applyAirQualityToToday(
      { ...snapshot.weather, ...patch },
      snapshot.acclimatization.thresholds,
    );
    const merged: ForecastSnapshot = { ...snapshot, weather };
    setState((current) => {
      if (current.snapshot !== snapshot) return current;
      return { ...current, snapshot: merged };
    });
    onMerged?.(merged);
  });
}
