import { useEffect, type RefObject } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';

import type { SavedLocation } from '@/services/locationStorage';
import { LOCATION_FOLLOW_THRESHOLD_M, hasMovedSignificantly } from '@/utils/geo';

import { adoptDeviceFix, isFollowingDevice } from './device-location';

type LoadForecast = (override?: SavedLocation | null, refreshOnly?: boolean) => Promise<void>;

/**
 * Keeps the forecast on the rider while they move, the way Apple Weather does:
 * once "Use Current Location" is picked (`source === 'device'`), a foreground
 * position watch re-points the forecast whenever they travel past the threshold.
 * Choosing a city in search flips `source` to `'manual'` and the watch stops.
 *
 * Foreground only — no background modes, no "Always" permission — so the watch is
 * torn down when the app is backgrounded and re-armed on resume. Web is excluded:
 * a standing `navigator.geolocation` watch leaves a permanent browser indicator,
 * and the foreground/pull-to-refresh re-checks cover it there.
 *
 * `relocatingRef` is shared with `useStaleRefresh`: resuming the app arms this
 * watch and runs a foreground re-check at the same moment, and both would see the
 * same move. The shared flag keeps that to one fetch.
 */
export function useFollowDeviceLocation(
  savedLocationRef: RefObject<SavedLocation | null>,
  relocatingRef: RefObject<boolean>,
  following: boolean,
  loadForecast: LoadForecast,
) {
  useEffect(() => {
    if (Platform.OS === 'web' || !following) return;

    // Set by the cleanup below; `start()` re-checks it after its awaits so a
    // subscription that resolves post-unmount is torn down immediately.
    const teardown = { cancelled: false, starting: false };
    let subscription: Location.LocationSubscription | null = null;

    const stop = () => {
      subscription?.remove();
      subscription = null;
    };

    const onPosition = async (position: Location.LocationObject) => {
      const current = savedLocationRef.current;
      if (!isFollowingDevice(current)) {
        stop();
        return;
      }
      const next = { lat: position.coords.latitude, lon: position.coords.longitude };
      if (relocatingRef.current || !hasMovedSignificantly(current, next)) return;
      relocatingRef.current = true;
      try {
        const adopted = await adoptDeviceFix(next);
        // Silent by design: no status message, just the refresh spinner and a
        // header city that changes once the new forecast lands.
        await loadForecast(adopted, true);
      } catch {
        // Best-effort: a failed save or fetch leaves the previous location in
        // place, and the next fix (or foreground resume) tries again.
      } finally {
        relocatingRef.current = false;
      }
    };

    const start = async () => {
      // Mount and the first AppState 'active' can land together; without the
      // flag both would get past the (still null) `subscription` check and leak
      // one of the two watches.
      if (teardown.starting || subscription || !isFollowingDevice(savedLocationRef.current)) return;
      teardown.starting = true;
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== Location.PermissionStatus.GRANTED) return;
        const next = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: LOCATION_FOLLOW_THRESHOLD_M,
          },
          (position) => {
            void onPosition(position);
          },
        );
        if (teardown.cancelled) next.remove();
        else subscription = next;
      } catch {
        // Location services unavailable; the foreground re-check still runs.
      } finally {
        teardown.starting = false;
      }
    };

    void start();
    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'active') void start();
        else stop();
      },
    );

    return () => {
      teardown.cancelled = true;
      stop();
      appStateSubscription.remove();
    };
  }, [following, loadForecast, relocatingRef, savedLocationRef]);
}
