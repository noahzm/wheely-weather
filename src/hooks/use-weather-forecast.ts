import { useCallback, useEffect, useRef, useState } from 'react';

import { type RecentLocation, type SavedLocation } from '@/services/locationStorage';
import { getForecastErrorKind } from '@/services/forecastSnapshot';
import { useExposureLevel, useHomeLocation, useSettingsHydrated } from '@/hooks/settings-context';
import { captureError } from '@/services/telemetry';

import {
  INITIAL_FORECAST_STATE,
  loadForecastData,
  persistResolvedDeviceName,
  togglePinnedLocation,
  type ForecastState,
} from './forecast/load-forecast-data';
import { refreshFollowedLocation } from './forecast/device-location';
import { mergeExtrasWhenReady } from './forecast/merge-extras';
import { useFollowDeviceLocation } from './forecast/use-follow-device-location';
import { useLocationActions } from './forecast/use-location-actions';
import {
  useSnapshotCacheHydration,
  useSnapshotCachePersistence,
} from './forecast/use-snapshot-cache';
import { useStaleRefresh } from './forecast/use-stale-refresh';

export function useWeatherForecast(mockScenario: string | null) {
  const [state, setState] = useState<ForecastState>(INITIAL_FORECAST_STATE);
  const [homeLocation] = useHomeLocation();
  const [exposureLevel] = useExposureLevel();
  const settingsHydrated = useSettingsHydrated();
  const lastLoadedAt = useRef(0);
  const needsLocationRef = useRef(false);
  // Mirrors state.savedLocation so the AppState/position listeners can read the
  // active coordinates without re-subscribing on every load.
  const savedLocationRef = useRef<SavedLocation | null>(null);
  // One mutex across every path that can adopt a new device fix (foreground
  // re-check, position watch, pull-to-refresh) so a single move costs one fetch.
  const relocatingRef = useRef(false);
  // Last-initiated-wins sequencing: a slower in-flight load must not overwrite a newer one.
  const loadGenRef = useRef(0);

  const loadForecast = useCallback(
    async (locationOverride?: SavedLocation | null, refreshOnly = false) => {
      const gen = ++loadGenRef.current;
      setState((current) => ({
        ...current,
        loading: !current.snapshot && !refreshOnly && !current.needsLocation,
        refreshing: !!current.snapshot || refreshOnly,
        errorKind: null,
      }));

      try {
        const result = await loadForecastData(
          locationOverride,
          mockScenario,
          homeLocation,
          exposureLevel,
        );
        if (gen !== loadGenRef.current) return;
        if (result.kind === 'needsLocation') {
          needsLocationRef.current = true;
          setState((current) => ({
            ...current,
            snapshot: null,
            savedLocation: null,
            recentLocations: result.recentLocations,
            pinnedLocations: result.pinnedLocations,
            loading: false,
            refreshing: false,
            needsLocation: true,
            errorKind: null,
            statusMessage: '',
          }));
          return;
        }

        persistResolvedDeviceName(result);

        lastLoadedAt.current = Date.now();
        needsLocationRef.current = false;
        setState((current) => ({
          ...current,
          snapshot: result.snapshot,
          savedLocation: result.savedLocation,
          recentLocations: result.recentLocations,
          pinnedLocations: result.pinnedLocations,
          loading: false,
          refreshing: false,
          needsLocation: false,
          errorKind: null,
          statusMessage: '',
        }));
        mergeExtrasWhenReady(result.snapshot, result.extras, setState);
      } catch (error) {
        if (gen !== loadGenRef.current) return;
        captureError(error, { where: 'loadForecast' });
        setState((current) => ({
          ...current,
          loading: false,
          refreshing: false,
          errorKind: getForecastErrorKind(error),
          statusMessage: '', // the error UI speaks for the failure now
        }));
      }
    },
    [mockScenario, homeLocation, exposureLevel],
  );

  // Wait for settings so the first fetch reads the real home location; without
  // the gate, its async hydration changed `loadForecast`'s identity and kicked
  // off a duplicate full fetch right after the first one.
  useEffect(() => {
    if (settingsHydrated) void loadForecast();
  }, [settingsHydrated, loadForecast]);

  // Kept in an effect rather than written inside `loadForecast` so the cache
  // hydration path (which also sets `savedLocation`) stays in sync too. Declared
  // above the listeners so they see the new value in the same commit.
  useEffect(() => {
    savedLocationRef.current = state.savedLocation;
  }, [state.savedLocation]);

  useSnapshotCacheHydration(setState, mockScenario);
  useSnapshotCachePersistence(state);
  useStaleRefresh(loadForecast, lastLoadedAt, needsLocationRef, savedLocationRef, relocatingRef);
  useFollowDeviceLocation(
    savedLocationRef,
    relocatingRef,
    // Mock previews must not run GPS or mutate the real persisted device fix.
    state.savedLocation?.source === 'device' && !mockScenario,
    loadForecast,
  );

  // Pull-to-refresh re-locates first, so a rider following their device gets the
  // forecast for where they are now, not where they were when they last opened.
  const refresh = useCallback(() => {
    if (needsLocationRef.current || relocatingRef.current) return;
    relocatingRef.current = true;
    void refreshFollowedLocation(savedLocationRef.current)
      .then((moved) => loadForecast(moved ?? undefined, true))
      .finally(() => {
        relocatingRef.current = false;
      });
  }, [loadForecast]);

  const { setManualLocation, useDeviceLocation } = useLocationActions(
    setState,
    loadForecast,
    needsLocationRef,
  );

  const togglePin = useCallback(
    async (place: RecentLocation) => {
      try {
        const pins = await togglePinnedLocation(place, state.pinnedLocations);
        setState((current) => ({ ...current, pinnedLocations: pins }));
      } catch {
        // Best-effort persistence (matches other pin/location storage calls);
        // on failure the UI just keeps its previous pin state.
      }
    },
    [state.pinnedLocations],
  );

  return {
    ...state,
    refresh,
    setManualLocation,
    useDeviceLocation,
    togglePin,
  };
}
