import { describe, it, expect } from 'vitest';

import { buildMockWeather } from '../../services/mockWeather';
import { THRESHOLDS } from '../../domain/constants';

import { mergeExtrasWhenReady } from './merge-extras';

import type { ForecastSnapshot } from '@/services/forecastSnapshot';
import type { ForecastExtras } from '@/types/weather';

import type { ForecastState } from './load-forecast-data';

function buildSnapshot(): ForecastSnapshot {
  const weather = buildMockWeather('ride');
  if (!weather) throw new Error('mock weather fixture missing');
  return {
    weather,
    location: 'Portland',
    lastUpdated: new Date(),
    isManualLocation: true,
    isDeviceLocation: false,
    mockScenario: null,
    source: 'manual',
    acclimatization: { homeBaseline: null, thresholds: THRESHOLDS },
  };
}

function buildState(snapshot: ForecastSnapshot | null): ForecastState {
  return {
    snapshot,
    savedLocation: null,
    recentLocations: [],
    pinnedLocations: [],
    loading: false,
    refreshing: false,
    needsLocation: false,
    errorKind: null,
    statusMessage: '',
  };
}

/** Collects setState updater calls and applies them to a given state. */
function fakeSetState() {
  const updaters: ((current: ForecastState) => ForecastState)[] = [];
  const setState = (action: ForecastState | ((current: ForecastState) => ForecastState)) => {
    if (typeof action !== 'function') throw new Error('expected updater form');
    updaters.push(action);
  };
  return { setState, updaters };
}

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const EXTRAS: ForecastExtras = { aqi: 42, nwsAlerts: [] };

describe('mergeExtrasWhenReady', () => {
  it('merges extras into the snapshot while it is still current', async () => {
    const snapshot = buildSnapshot();
    const { setState, updaters } = fakeSetState();

    mergeExtrasWhenReady(snapshot, Promise.resolve(EXTRAS), setState);
    await flushMicrotasks();

    expect(updaters).toHaveLength(1);
    const next = updaters[0]?.(buildState(snapshot));
    expect(next?.snapshot?.weather.aqi).toBe(42);
    expect(next?.snapshot?.weather.temperature).toBe(snapshot.weather.temperature);
    expect(next?.snapshot?.location).toBe('Portland');
  });

  it('leaves state untouched when a newer snapshot replaced the one being patched', async () => {
    const stale = buildSnapshot();
    const { setState, updaters } = fakeSetState();

    mergeExtrasWhenReady(stale, Promise.resolve(EXTRAS), setState);
    await flushMicrotasks();

    const currentState = buildState(buildSnapshot());
    expect(updaters[0]?.(currentState)).toBe(currentState);
  });

  it('does not touch state for a null or empty patch', async () => {
    const snapshot = buildSnapshot();
    const { setState, updaters } = fakeSetState();

    mergeExtrasWhenReady(snapshot, Promise.resolve(null), setState);
    mergeExtrasWhenReady(snapshot, Promise.resolve({ aqi: null, nwsAlerts: [] }), setState);
    await flushMicrotasks();

    expect(updaters).toHaveLength(0);
  });
});
