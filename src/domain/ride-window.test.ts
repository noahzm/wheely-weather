import { describe, expect, it } from 'vitest';

import { THRESHOLDS } from './constants';
import {
  buildRideWindowCandidate,
  scoreRideWindow,
  selectBestRideWindow,
  selectBestRideWindows,
  type RideWindowHour,
} from './ride-window';

function hour(h: number, overrides: Partial<RideWindowHour> = {}): RideWindowHour {
  return {
    hour: h,
    temperature: 68,
    windSpeed: 5,
    windGust: 8,
    rainChance: 0,
    precipitation: 0,
    dewpoint: 50,
    weatherCode: 1,
    ...overrides,
  };
}

const hours = (from: number, to: number, overrides: Partial<RideWindowHour> = {}) =>
  Array.from({ length: to - from }, (_, i) => hour(from + i, overrides));

describe('buildRideWindowCandidate', () => {
  it('keeps the worst value of each metric', () => {
    const window = buildRideWindowCandidate(
      [
        hour(9, { temperature: 60, windGust: null, rainChance: 10, weatherCode: 1 }),
        hour(10, { temperature: 72, windSpeed: 12, rainChance: 40, weatherCode: 61 }),
        hour(11, { dewpoint: 58, windGust: 20 }),
      ],
      THRESHOLDS,
    );
    expect(window).toMatchObject({
      startHour: 9,
      endHour: 12,
      tempLow: 60,
      tempHigh: 72,
      windSpeed: 12,
      windGust: 20,
      rainChance: 40,
      dewpoint: 58,
      weatherCode: 61,
    });
  });

  it('leaves the rain amount unknown when any hour lacks it', () => {
    const window = buildRideWindowCandidate(
      [hour(9, { precipitation: 0.2 }), hour(10, { precipitation: null })],
      THRESHOLDS,
    );
    expect(window?.precipitation).toBeNull();
  });

  it('reports no gust, dewpoint or code when no hour has one', () => {
    const window = buildRideWindowCandidate(
      [hour(9, { windGust: null, dewpoint: null, weatherCode: null })],
      THRESHOLDS,
    );
    expect(window).toMatchObject({ windGust: null, dewpoint: null, weatherCode: null });
  });

  it('rejects empty and non-contiguous hours', () => {
    expect(buildRideWindowCandidate([], THRESHOLDS)).toBeNull();
    expect(buildRideWindowCandidate([hour(9), hour(11)], THRESHOLDS)).toBeNull();
  });
});

describe('scoreRideWindow', () => {
  it('prefers a calmer window with the same rating', () => {
    const calm = buildRideWindowCandidate(hours(9, 12), THRESHOLDS);
    const breezy = buildRideWindowCandidate(hours(9, 12, { windSpeed: 8 }), THRESHOLDS);
    if (!calm || !breezy) throw new Error('expected windows');
    expect(calm.condition).toBe(breezy.condition);
    expect(scoreRideWindow(calm)).toBeGreaterThan(scoreRideWindow(breezy));
  });
});

describe('selectBestRideWindow', () => {
  it('picks the three hours that avoid a rough hour', () => {
    const day = [...hours(9, 12), hour(12, { rainChance: 90, weatherCode: 63 }), ...hours(13, 16)];
    const best = selectBestRideWindow(day, THRESHOLDS);
    expect(best?.rainChance).toBe(0);
    expect(best && (best.endHour <= 12 || best.startHour >= 13)).toBe(true);
  });

  it('needs at least `minHours` hours', () => {
    expect(selectBestRideWindow(hours(15, 17), THRESHOLDS)).toBeNull();
    expect(selectBestRideWindow(hours(15, 17), THRESHOLDS, 2)).toMatchObject({
      startHour: 15,
      endHour: 17,
    });
  });
});

describe('selectBestRideWindows', () => {
  it('lets only today settle for a shorter window', () => {
    const windows = selectBestRideWindows(
      { '2026-10-09': hours(16, 18), '2026-10-10': hours(16, 18) },
      '2026-10-09',
      THRESHOLDS,
    );
    expect(Object.keys(windows)).toEqual(['2026-10-09']);
  });
});
