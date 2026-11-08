import type { SavedLocation } from '@/services/locationStorage';

export const STALE_REFRESH_MS = 15 * 60 * 1000;
const RETRY_REFRESH_MS = 60 * 1000;

interface RefreshOptions {
  loadForecast: (override?: SavedLocation | null, refreshOnly?: boolean) => Promise<void>;
  lastLoadedAt: { current: number };
  needsLocationRef: { current: boolean };
  relocatingRef: { current: boolean };
  loadingRef: { current: boolean };
  relocate: () => Promise<SavedLocation | null>;
  getAppState: () => string | null | undefined;
  subscribe: (onChange: () => void) => () => void;
  onError: (error: unknown) => void;
}

/** Runs only while active, with one stale refresh in flight and bounded retries. */
export function startStaleRefresh(options: RefreshOptions): () => void {
  const { lastLoadedAt, needsLocationRef, relocatingRef, loadingRef } = options;
  let disposed = false;
  let refreshing = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const isActive = () => !disposed && options.getAppState() === 'active';

  const clearTimer = () => {
    clearTimeout(timer);
    timer = undefined;
  };

  const schedule = () => {
    clearTimer();
    if (!isActive()) return;
    const age = Date.now() - lastLoadedAt.current;
    // A failed load, an ongoing load or an unset location should not spin.
    const delay = Math.max(RETRY_REFRESH_MS, STALE_REFRESH_MS - age);
    timer = setTimeout(() => void refresh(false), delay);
  };

  const refresh = async (checkLocation: boolean) => {
    if (!isActive() || refreshing) return;
    refreshing = true;
    clearTimer();
    try {
      if (needsLocationRef.current || relocatingRef.current || loadingRef.current) return;
      let moved: SavedLocation | null = null;
      if (checkLocation) {
        relocatingRef.current = true;
        try {
          moved = await options.relocate();
          if (!isActive()) return;
          if (moved) await options.loadForecast(moved, true);
        } finally {
          relocatingRef.current = false;
        }
      }
      // Release the relocation mutex before a stale-only fetch so a newer
      // position-watch fix can supersede it through the load generation.
      if (
        isActive() &&
        !moved &&
        (!lastLoadedAt.current || Date.now() - lastLoadedAt.current >= STALE_REFRESH_MS)
      ) {
        await options.loadForecast(undefined, true);
      }
    } catch (error) {
      options.onError(error);
    } finally {
      refreshing = false;
      schedule();
    }
  };

  const unsubscribe = options.subscribe(() => {
    clearTimer();
    if (options.getAppState() === 'active') void refresh(true);
  });
  // The mount load already owns the first request; wait until it could be stale.
  schedule();
  return () => {
    disposed = true;
    clearTimer();
    unsubscribe();
  };
}
