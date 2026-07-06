import type { Dispatch, SetStateAction } from 'react';

import type { ForecastSnapshot } from '@/services/forecastSnapshot';
import type { ForecastExtras } from '@/types/weather';

import type { ForecastState } from './load-forecast-data';

/**
 * Patches AQI/NWS alerts into the snapshot once the (non-blocking) extras
 * fetch settles. The snapshot-identity guard drops the merge for free when a
 * newer load has replaced it in the meantime.
 */
export function mergeExtrasWhenReady(
  snapshot: ForecastSnapshot,
  extras: Promise<ForecastExtras | null>,
  setState: Dispatch<SetStateAction<ForecastState>>,
): void {
  void extras.then((patch) => {
    // Skip empty patches so a fetch that found nothing doesn't churn state.
    if (!patch || (patch.aqi === null && patch.nwsAlerts.length === 0)) return;
    setState((current) => {
      if (current.snapshot !== snapshot) return current;
      return {
        ...current,
        snapshot: { ...snapshot, weather: { ...snapshot.weather, ...patch } },
      };
    });
  });
}
