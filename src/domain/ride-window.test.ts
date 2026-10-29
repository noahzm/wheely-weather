import { describe, expect, it } from 'vitest';

import { resolveThresholds } from './acclimatization';
import { THRESHOLDS } from './constants';
import {
  ALL_DAY_RIDE_HOURS,
  buildRideWindowCandidate,
  hoursFromDaylight,
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

  it('keeps the window’s highest UV, or null when no hour has one', () => {
    const sunny = buildRideWindowCandidate(
      [hour(9, { uv: 3 }), hour(10, { uv: 6 }), hour(11, { uv: null })],
      THRESHOLDS,
    );
    expect(sunny?.uvMax).toBe(6);
    expect(buildRideWindowCandidate([hour(9), hour(10)], THRESHOLDS)?.uvMax).toBeNull();
  });

  it('rates heat and humidity on the hourly heat index peak', () => {
    // The 2 PM heat and the 9 AM humidity, paired, would be a 108°F heat index.
    const window = buildRideWindowCandidate(
      [
        hour(9, { temperature: 88, dewpoint: 76 }),
        hour(10, { temperature: 91, dewpoint: 70 }),
        hour(11, { temperature: 94, dewpoint: 66 }),
      ],
      resolveThresholds({ warmTemp: 95, warmDewpoint: 76, coolTemp: 60 }, THRESHOLDS, 'high'),
    );
    expect(window?.heatIndexMax).toBeCloseTo(99, 0);
    expect(window?.condition).toBe('marginal');
    const dry = buildRideWindowCandidate([hour(9, { dewpoint: null })], THRESHOLDS);
    expect(dry?.heatIndexMax).toBeNull();
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

describe('hoursFromDaylight', () => {
  const daylight = { sunriseHour: 6, sunsetHour: 20 };

  it('is 0 in daylight and counts out from dusk and dawn', () => {
    expect(hoursFromDaylight(6, daylight)).toBe(0);
    expect(hoursFromDaylight(19, daylight)).toBe(0);
    expect(hoursFromDaylight(20, daylight)).toBe(1);
    expect(hoursFromDaylight(22, daylight)).toBe(3);
    expect(hoursFromDaylight(5, daylight)).toBe(1);
    expect(hoursFromDaylight(3, daylight)).toBe(3);
  });

  it('measures the middle of the night to the nearer of dusk and dawn', () => {
    expect(hoursFromDaylight(0, daylight)).toBe(5);
    expect(hoursFromDaylight(1, daylight)).toBe(5);
    expect(hoursFromDaylight(2, daylight)).toBe(4);
  });
});

/**
 * A summer day with night riding on: 72°F and calm overnight, 88°F and breezy
 * mid-afternoon, so the small hours score best on weather alone.
 */
function summerNight(): RideWindowHour[] {
  const daylight = { sunriseHour: 6, sunsetHour: 20 };
  return Array.from({ length: 24 }, (_, h) => {
    const wind = h >= 9 && h <= 19 ? 9 : 4;
    return hour(h, {
      temperature: 72 + 16 * Math.max(0, Math.sin(((h - 6) / 12) * Math.PI)),
      windSpeed: wind,
      windGust: wind + 4,
      dewpoint: 60,
      darkness: hoursFromDaylight(h, daylight),
    });
  });
}

describe('selectBestRideWindow with night riding', () => {
  it('escapes a rained-out day at dusk or dawn, not the middle of the night', () => {
    const rainyDay = summerNight().map((h) =>
      h.darkness ? h : { ...h, rainChance: 90, precipitation: 3, weatherCode: 63 },
    );
    const best = selectBestRideWindow(rainyDay, THRESHOLDS);
    expect(best?.condition).not.toBe('bad');
    expect([
      [20, 23],
      [3, 6],
    ]).toContainEqual([best?.startHour, best?.endHour]);
  });

  it('keeps daylight when the calm, cool small hours rate no better', () => {
    const best = selectBestRideWindow(summerNight(), THRESHOLDS);
    expect(best?.startHour).toBeGreaterThanOrEqual(6);
    expect(best?.endHour).toBeLessThanOrEqual(20);
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

  it('respects custom targetHours for 1-hour and 4-hour ride lengths', () => {
    const shortWindows = selectBestRideWindows(
      { '2026-10-09': [hour(17)], '2026-10-10': hours(9, 13) },
      '2026-10-09',
      THRESHOLDS,
      1,
    );
    expect(shortWindows['2026-10-09']).toMatchObject({ startHour: 17, endHour: 18 });
    expect(shortWindows['2026-10-10']).toMatchObject({ startHour: 9, endHour: 10 });

    const longWindows = selectBestRideWindows(
      { '2026-10-10': hours(9, 15) },
      '2026-10-09',
      THRESHOLDS,
      4,
    );
    expect(longWindows['2026-10-10']).toMatchObject({ startHour: 9, endHour: 13 });
  });

  it('spans all of each day’s daylight for an all-day ride', () => {
    const windows = selectBestRideWindows(
      {
        '2026-10-09': hours(14, 18),
        '2026-10-10': hours(7, 18),
        // A short winter day still gets its whole daylight as one window.
        '2026-10-11': hours(9, 15),
      },
      '2026-10-09',
      THRESHOLDS,
      ALL_DAY_RIDE_HOURS,
    );
    expect(windows['2026-10-09']).toMatchObject({ startHour: 14, endHour: 18 });
    expect(windows['2026-10-10']).toMatchObject({ startHour: 7, endHour: 18 });
    expect(windows['2026-10-11']).toMatchObject({ startHour: 9, endHour: 15 });
  });

  it('still needs two hours today for an all-day ride unless nightRiding is enabled', () => {
    const windows = selectBestRideWindows(
      { '2026-10-09': [hour(17)] },
      '2026-10-09',
      THRESHOLDS,
      ALL_DAY_RIDE_HOURS,
    );
    expect(windows).toEqual({});

    const lateNightWindows = selectBestRideWindows(
      { '2026-10-09': [hour(23)] },
      '2026-10-09',
      THRESHOLDS,
      3,
      true,
    );
    expect(lateNightWindows['2026-10-09']).toMatchObject({ startHour: 23, endHour: 24 });
  });
});
