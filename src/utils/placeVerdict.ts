import { getRideVerdict, getRideVerdictLabel } from '@/domain';
import { getMemoryCachedForecast } from '@/services/snapshotMemoryCache';
import type { Condition } from '@/types/weather';

import type { TempUnit } from './temperature';

/** A saved place's verdict at a glance, for the Search list. */
export interface PlaceVerdict {
  label: string;
  condition: Condition;
  /** Bad now, good later: shown in the accent pink like the home card. */
  waiting: boolean;
}

/**
 * The verdict for a saved place from its cached forecast, or null when none is
 * cached. Never fetches: pinned places are prefetched in the background and
 * places you've viewed stay cached, so the Search list costs no network calls.
 */
export function getCachedPlaceVerdict(
  place: { lat: number; lon: number },
  tempUnit: TempUnit,
): PlaceVerdict | null {
  const cached = getMemoryCachedForecast(place);
  if (!cached) return null;
  const { weather, location, acclimatization } = cached.snapshot;
  const verdict = getRideVerdict(weather, acclimatization.thresholds, tempUnit);
  return {
    label: getRideVerdictLabel(verdict, location),
    condition: verdict.condition,
    waiting: verdict.when === 'wait',
  };
}
