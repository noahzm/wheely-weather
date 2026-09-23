import { type RefObject, useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import type { SavedLocation } from '@/services/locationStorage';

const STALE_REFRESH_MS = 15 * 60 * 1000;

/**
 * On foreground, re-point the forecast before deciding it is stale: a rider
 * following their device location may have travelled while the app was away.
 * Both checks share one listener so a move plus a stale forecast still cost a
 * single fetch. `relocate` resolves the new device fix when the rider has moved
 * (see `refreshFollowedLocation`), or null to skip straight to the stale check.
 */
export function useStaleRefresh(
  loadForecast: (override?: SavedLocation | null, refreshOnly?: boolean) => Promise<void>,
  lastLoadedAt: RefObject<number>,
  needsLocationRef: RefObject<boolean>,
  relocate: () => Promise<SavedLocation | null>,
  relocatingRef: RefObject<boolean>,
) {
  useEffect(() => {
    const onForeground = async () => {
      // `relocatingRef` is shared with the position watch, which re-arms on this
      // same resume; without it a single move would fetch twice.
      if (needsLocationRef.current || relocatingRef.current) return;
      relocatingRef.current = true;
      try {
        const moved = await relocate();
        if (moved) {
          await loadForecast(moved, true);
          return;
        }
        if (!lastLoadedAt.current || Date.now() - lastLoadedAt.current > STALE_REFRESH_MS) {
          await loadForecast(undefined, true);
        }
      } finally {
        relocatingRef.current = false;
      }
    };

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState !== 'active') return;
      void onForeground();
    });
    return () => {
      subscription.remove();
    };
  }, [loadForecast, lastLoadedAt, needsLocationRef, relocate, relocatingRef]);
}
