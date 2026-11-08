import { useEffect } from 'react';
import { AppState } from 'react-native';

import { captureError } from '@/services/telemetry';

import { startStaleRefresh } from './stale-refresh';

type RefreshOptions = Pick<
  Parameters<typeof startStaleRefresh>[0],
  'loadForecast' | 'lastLoadedAt' | 'needsLocationRef' | 'relocate' | 'relocatingRef' | 'loadingRef'
>;

/** Refreshes stale forecasts while active and rechecks location on resume. */
export function useStaleRefresh({
  loadForecast,
  lastLoadedAt,
  needsLocationRef,
  relocate,
  relocatingRef,
  loadingRef,
}: RefreshOptions) {
  useEffect(
    () =>
      startStaleRefresh({
        loadForecast,
        lastLoadedAt,
        needsLocationRef,
        relocate,
        relocatingRef,
        loadingRef,
        getAppState: () => AppState.currentState,
        subscribe: (onChange) => {
          const subscription = AppState.addEventListener('change', onChange);
          return () => {
            subscription.remove();
          };
        },
        onError: (error) => {
          captureError(error, { where: 'staleRefresh' });
        },
      }),
    [loadForecast, lastLoadedAt, needsLocationRef, relocate, relocatingRef, loadingRef],
  );
}
