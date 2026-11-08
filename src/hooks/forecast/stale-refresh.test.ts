import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SavedLocation } from '@/services/locationStorage';

import { STALE_REFRESH_MS, startStaleRefresh } from './stale-refresh';

function setup() {
  const lastLoadedAt = { current: Date.now() };
  const needsLocationRef = { current: false };
  const relocatingRef = { current: false };
  const loadingRef = { current: false };
  let appState = 'active';
  let onChange: () => void = vi.fn();
  const unsubscribe = vi.fn();
  const loadForecast = vi.fn<
    (location?: SavedLocation | null, refreshOnly?: boolean) => Promise<void>
  >(() => {
    lastLoadedAt.current = Date.now();
    return Promise.resolve();
  });
  const relocate = vi.fn<() => Promise<SavedLocation | null>>().mockResolvedValue(null);
  const onError = vi.fn();
  const stop = startStaleRefresh({
    loadForecast,
    lastLoadedAt,
    needsLocationRef,
    relocatingRef,
    loadingRef,
    relocate,
    onError,
    getAppState: () => appState,
    subscribe: (listener) => {
      onChange = listener;
      return unsubscribe;
    },
  });
  return {
    loadForecast,
    lastLoadedAt,
    needsLocationRef,
    relocatingRef,
    loadingRef,
    relocate,
    onError,
    stop,
    unsubscribe,
    setAppState: (next: string) => {
      appState = next;
      onChange();
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-07T14:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('foreground forecast refresh', () => {
  it('refreshes at the stale boundary while the app stays open, without polling GPS', async () => {
    const run = setup();
    await vi.advanceTimersByTimeAsync(STALE_REFRESH_MS - 1);
    expect(run.loadForecast).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(run.loadForecast).toHaveBeenCalledExactlyOnceWith(undefined, true);
    expect(run.relocate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(STALE_REFRESH_MS);
    expect(run.loadForecast).toHaveBeenCalledTimes(2);
    run.stop();
  });

  it('rechecks freshness after another action updates the forecast', async () => {
    const run = setup();
    await vi.advanceTimersByTimeAsync(STALE_REFRESH_MS / 2);
    run.lastLoadedAt.current = Date.now();
    await vi.advanceTimersByTimeAsync(STALE_REFRESH_MS / 2);
    expect(run.loadForecast).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(STALE_REFRESH_MS / 2);
    expect(run.loadForecast).toHaveBeenCalledTimes(1);
    run.stop();
  });

  it('pauses timers in the background and refreshes once on a stale resume', async () => {
    const run = setup();
    run.setAppState('background');
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(STALE_REFRESH_MS * 2);
    expect(run.loadForecast).not.toHaveBeenCalled();
    run.setAppState('active');
    await vi.advanceTimersByTimeAsync(0);
    expect(run.relocate).toHaveBeenCalledTimes(1);
    expect(run.loadForecast).toHaveBeenCalledExactlyOnceWith(undefined, true);
    run.stop();
  });

  it('checks location on a fresh resume without refetching an unchanged place', async () => {
    const run = setup();
    run.setAppState('inactive');
    run.setAppState('active');
    await vi.advanceTimersByTimeAsync(0);
    expect(run.relocate).toHaveBeenCalledTimes(1);
    expect(run.loadForecast).not.toHaveBeenCalled();
    run.stop();
  });

  it('loads a moved device fix only once even when the forecast is stale', async () => {
    const run = setup();
    const moved: SavedLocation = { lat: 40, lon: -74, name: null, source: 'device' };
    run.relocate.mockResolvedValue(moved);
    run.lastLoadedAt.current = 0;
    run.setAppState('active');
    await vi.advanceTimersByTimeAsync(0);
    expect(run.loadForecast).toHaveBeenCalledExactlyOnceWith(moved, true);
    expect(run.relocatingRef.current).toBe(false);
    run.stop();
  });

  it.each(['needsLocationRef', 'relocatingRef', 'loadingRef'] as const)(
    'defers a refresh while %s is set, then retries',
    async (key) => {
      const run = setup();
      run[key].current = true;
      await vi.advanceTimersByTimeAsync(STALE_REFRESH_MS);
      expect(run.loadForecast).not.toHaveBeenCalled();
      run[key].current = false;
      await vi.advanceTimersByTimeAsync(60_000);
      expect(run.loadForecast).toHaveBeenCalledTimes(1);
      run.stop();
    },
  );

  it('does not overlap a slow refresh with a resume event or another timer', async () => {
    const run = setup();
    const pending = Promise.withResolvers<null>();
    run.loadForecast.mockImplementation(async () => {
      await pending.promise;
    });
    await vi.advanceTimersByTimeAsync(STALE_REFRESH_MS);
    run.setAppState('active');
    await vi.advanceTimersByTimeAsync(STALE_REFRESH_MS);
    expect(run.loadForecast).toHaveBeenCalledTimes(1);
    pending.resolve(null);
    await vi.advanceTimersByTimeAsync(0);
    run.stop();
  });

  it('reports a failed refresh and retries without a tight loop', async () => {
    const run = setup();
    const error = new Error('offline');
    run.loadForecast.mockRejectedValueOnce(error);
    await vi.advanceTimersByTimeAsync(STALE_REFRESH_MS);
    expect(run.onError).toHaveBeenCalledExactlyOnceWith(error);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(run.loadForecast).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(run.loadForecast).toHaveBeenCalledTimes(2);
    run.stop();
  });

  it('cancels timers and ignores a relocation that finishes after cleanup', async () => {
    const run = setup();
    const pending = Promise.withResolvers<SavedLocation | null>();
    run.relocate.mockReturnValue(pending.promise);
    run.lastLoadedAt.current = 0;
    run.setAppState('active');
    run.stop();
    pending.resolve({ lat: 40, lon: -74, name: null, source: 'device' });
    await vi.advanceTimersByTimeAsync(STALE_REFRESH_MS);
    expect(run.loadForecast).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(run.unsubscribe).toHaveBeenCalledTimes(1);
    expect(run.relocatingRef.current).toBe(false);
  });
});
