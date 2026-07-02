import { type RefObject, useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import type { SavedLocation } from '@/services/locationStorage';

const STALE_REFRESH_MS = 15 * 60 * 1000;

export function useStaleRefresh(
  loadForecast: (override?: SavedLocation | null, refreshOnly?: boolean) => Promise<void>,
  lastLoadedAt: RefObject<number>,
  needsLocationRef: RefObject<boolean>,
) {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState !== 'active') return;
      if (needsLocationRef.current) return;
      if (!lastLoadedAt.current || Date.now() - lastLoadedAt.current > STALE_REFRESH_MS) {
        void loadForecast(undefined, true);
      }
    });
    return () => {
      subscription.remove();
    };
  }, [loadForecast, lastLoadedAt, needsLocationRef]);
}
